from fastapi import APIRouter, HTTPException, Depends, Query
from database import db
from auth import hash_password, verify_password, create_token, get_current_user
from models import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    TokenResponse,
    VerifyEmailResponse,
    ResendVerificationRequest,
)
from datetime import datetime, timezone, timedelta
from email_service import send_verification_email
from services.guest_merge import merge_guest_into_profile
import re
import secrets
import uuid
import logging
import os

router = APIRouter(prefix="/api/auth", tags=["auth"])

ADMIN_EMAILS = ["padrapatricio@gmail.com"]
logger = logging.getLogger(__name__)

# En Render Free conviene dejar esto en false porque SMTP está bloqueado.
# En Render, agregá la variable:
# EMAIL_VERIFICATION_ENABLED=false
EMAIL_VERIFICATION_ENABLED = (
    os.getenv("EMAIL_VERIFICATION_ENABLED", "false").lower() == "true"
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_verification_token() -> str:
    return secrets.token_urlsafe(32)


def _new_verification_expiration_iso(hours: int = 24) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def _is_expired(iso_value: str | None) -> bool:
    if not iso_value:
        return True
    try:
        expires_at = datetime.fromisoformat(iso_value)
    except Exception:
        return True
    return expires_at < datetime.now(timezone.utc)


async def _find_user_by_email(email: str) -> dict | None:
    """Busca el usuario por email, contemplando cuentas legacy.

    Los modelos ya normalizan el email a minúscula, así que el find_one exacto
    resuelve el 99% de los casos y usa el índice. El fallback case-insensitive
    existe sólo para las cuentas creadas ANTES de la normalización, que pueden
    tener el email guardado con mayúsculas: sin esto no podrían loguear nunca
    más.
    """
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        return user

    return await db.users.find_one(
        {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}},
        {"_id": 0},
    )


async def _normalize_legacy_user_email(user: dict, email: str) -> None:
    """Migra en caliente el email de una cuenta legacy a minúscula.

    Se llama recién después de validar la contraseña, así el arreglo lo dispara
    el dueño de la cuenta y no cualquiera que tipee el mail. Si ya existe otra
    cuenta con el email en minúscula (duplicado por mayúsculas) no tocamos nada
    y lo dejamos logueado igual: resolverlo pisando datos sería peor.
    """
    if user.get("email") == email:
        return

    conflict = await db.users.find_one(
        {"email": email, "id": {"$ne": user["id"]}}, {"_id": 0}
    )
    if conflict:
        logger.warning(
            f"No se normalizó el email de {user['id']}: ya existe otra cuenta con {email}"
        )
        return

    await db.users.update_one({"id": user["id"]}, {"$set": {"email": email}})

    # El perfil también guarda el email y se busca en minúscula (invitados,
    # invitaciones a grupo), así que lo dejamos alineado.
    await db.player_profiles.update_many(
        {"user_id": user["id"]}, {"$set": {"email": email}}
    )


@router.post("/register", response_model=RegisterResponse)
async def register(data: RegisterRequest):
    # El email ya viene normalizado a minúscula por el modelo. La búsqueda
    # contempla cuentas legacy con mayúsculas para no crear un duplicado.
    existing = await _find_user_by_email(data.email)
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 or data.email in ADMIN_EMAILS else "jugador"

    user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    now = _now_iso()

    verification_token = _new_verification_token() if EMAIL_VERIFICATION_ENABLED else None
    verification_token_expires_at = (
        _new_verification_expiration_iso() if EMAIL_VERIFICATION_ENABLED else None
    )

    user_doc = {
        "id": user_id,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "role": role,
        "created_at": now,

        # Si la verificación está apagada, el usuario nace verificado.
        "is_verified": not EMAIL_VERIFICATION_ENABLED,
        "verification_token": verification_token,
        "verification_token_expires_at": verification_token_expires_at,
        "verified_at": now if not EMAIL_VERIFICATION_ENABLED else None,
    }

    await db.users.insert_one(user_doc)

    # Si alguien te anotó como invitado antes de que tuvieras cuenta, y usó el
    # mismo email, recuperamos ese perfil (foto, posición, nivel) y su historial
    # de partidos/calificaciones en vez de arrancar de cero.
    matched_guest = await db.player_profiles.find_one(
        {"email": data.email, "player_type": "invitado", "user_id": None},
        {"_id": 0},
    )

    profile_doc = {
        "id": profile_id,
        "user_id": user_id,
        "name": data.name,
        "email": data.email,
        "photo_url": matched_guest.get("photo_url") if matched_guest else None,
        "birth_date": matched_guest.get("birth_date") if matched_guest else None,
        "player_type": "frecuente",
        "primary_position": matched_guest.get("primary_position") if matched_guest else None,
        "secondary_positions": (matched_guest.get("secondary_positions") or []) if matched_guest else [],
        "unwanted_position": matched_guest.get("unwanted_position") if matched_guest else None,
        "matches_played": 0,
        "created_by": None,
        "estimated_level": matched_guest.get("estimated_level", 5.0) if matched_guest else 5.0,
        "created_at": now,
    }
    if matched_guest and matched_guest.get("photo_public_id"):
        profile_doc["photo_public_id"] = matched_guest["photo_public_id"]

    await db.player_profiles.insert_one(profile_doc)

    linked_guest_history = False
    if matched_guest:
        merged = await merge_guest_into_profile(matched_guest["id"], profile_id)
        linked_guest_history = merged is not None

    verification_sent = False

    if EMAIL_VERIFICATION_ENABLED:
        try:
            send_verification_email(data.email, data.name, verification_token)
            verification_sent = True
        except Exception as e:
            logger.exception(
                f"No se pudo enviar email de verificación a {data.email}: {e}"
            )

            # Como la verificación está activada, si no se puede enviar el mail
            # no tiene sentido dejar avanzar el registro.
            raise HTTPException(
                status_code=500,
                detail="No se pudo enviar el email de verificación",
            )

    message = (
        "Cuenta creada. Revisá tu email para activar la cuenta."
        if EMAIL_VERIFICATION_ENABLED
        else "Cuenta creada correctamente. Ya podés iniciar sesión."
    )

    return RegisterResponse(
        message=message,
        email=data.email,
        verification_required=EMAIL_VERIFICATION_ENABLED,
        verification_sent=verification_sent,
        linked_guest_history=linked_guest_history,
    )


@router.get("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(token: str = Query(...)):
    if not EMAIL_VERIFICATION_ENABLED:
        return VerifyEmailResponse(
            message="La verificación por email está desactivada."
        )

    user = await db.users.find_one({"verification_token": token}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Link inválido o ya usado")

    if user.get("is_verified") is True:
        return VerifyEmailResponse(message="La cuenta ya estaba verificada")

    if _is_expired(user.get("verification_token_expires_at")):
        raise HTTPException(status_code=400, detail="El link de verificación venció")

    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "is_verified": True,
                "verified_at": _now_iso(),
            },
            "$unset": {
                "verification_token": "",
                "verification_token_expires_at": "",
            },
        },
    )

    return VerifyEmailResponse(
        message="Cuenta verificada correctamente. Ya podés iniciar sesión."
    )


@router.post("/resend-verification", response_model=VerifyEmailResponse)
async def resend_verification(data: ResendVerificationRequest):
    if not EMAIL_VERIFICATION_ENABLED:
        return VerifyEmailResponse(
            message="La verificación por email está desactivada."
        )

    user = await _find_user_by_email(data.email)
    if not user:
        raise HTTPException(status_code=404, detail="No existe una cuenta con ese email")

    # Los usuarios viejos sin campo is_verified no se bloquean.
    if user.get("is_verified", True) is True:
        return VerifyEmailResponse(message="La cuenta ya está verificada")

    profile = await db.player_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    verification_token = _new_verification_token()
    verification_token_expires_at = _new_verification_expiration_iso()

    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "verification_token": verification_token,
                "verification_token_expires_at": verification_token_expires_at,
            }
        },
    )

    try:
        send_verification_email(
            user["email"],
            profile.get("name") or user["email"],
            verification_token,
        )
    except Exception as e:
        logger.exception(
            f"No se pudo reenviar email de verificación a {user['email']}: {e}"
        )
        raise HTTPException(
            status_code=500,
            detail="No se pudo reenviar el email de verificación",
        )

    return VerifyEmailResponse(message="Te reenviamos el email de verificación")


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    user = await _find_user_by_email(data.email)
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    # Cuenta vieja guardada con mayúsculas: la normalizamos ahora que sabemos
    # que la contraseña es correcta.
    await _normalize_legacy_user_email(user, data.email)

    # Importante: los usuarios legacy sin este campo siguen pudiendo entrar.
    if user.get("is_verified", True) is not True:
        raise HTTPException(
            status_code=403,
            detail="Debés verificar tu cuenta antes de iniciar sesión",
        )

    profile = await db.player_profiles.find_one(
        {"user_id": user["id"]}, {"_id": 0}
    )

    has_profile = bool(
        profile
        and profile.get("primary_position")
        and profile.get("birth_date")
    )

    token = create_token(user["id"], user["role"])

    return TokenResponse(
        token=token,
        user_id=user["id"],
        role=user["role"],
        profile_id=profile["id"] if profile else "",
        has_profile=has_profile,
        name=profile["name"] if profile else "",
    )


@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    user_doc = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    profile = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )

    return {
        "user_id": user_doc["id"],
        "email": user_doc["email"],
        "role": user_doc["role"],
        "is_verified": user_doc.get("is_verified", True),
        "profile": profile,
        "has_profile": bool(
            profile and profile.get("primary_position") and profile.get("birth_date")
        ),
    }