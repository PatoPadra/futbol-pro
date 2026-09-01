from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from database import db
from auth import get_current_user
from models import ProfileUpdate, ProfileResponse
from datetime import datetime, timezone
from pathlib import Path

from services.account import anonimizar_cuenta
from storage_cloudinary import ImagenNoSubida, delete_image, upload_image_bytes

router = APIRouter(prefix="/api/profile", tags=["profile"])


def _calculate_age(birth_date_str: str) -> int:
    try:
        bd = datetime.strptime(birth_date_str, "%Y-%m-%d")
        today = datetime.now(timezone.utc)
        age = today.year - bd.year
        if (today.month, today.day) < (bd.month, bd.day):
            age -= 1
        return age
    except (ValueError, TypeError):
        return 0


@router.get("", response_model=ProfileResponse)
async def get_profile(user=Depends(get_current_user)):
    profile = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    if profile.get("birth_date"):
        profile["age"] = _calculate_age(profile["birth_date"])
    return ProfileResponse(**profile)


@router.put("", response_model=ProfileResponse)
async def update_profile(data: ProfileUpdate, user=Depends(get_current_user)):
    profile = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.birth_date is not None:
        update_data["birth_date"] = data.birth_date
    # El género se distingue del resto: acá `None` no significa "no lo mandes",
    # significa "borralo". Los otros campos son str y usan '' para vaciarse, pero
    # género es un Literal cerrado y '' no es un valor válido. Por eso se mira si
    # la clave vino en el JSON (model_fields_set) en vez de si el valor es None:
    # así se puede setear Y volver atrás, y omitir la clave sigue sin tocar nada.
    if "gender" in data.model_fields_set:
        update_data["gender"] = data.gender
    if data.primary_position is not None:
        update_data["primary_position"] = data.primary_position
    if data.secondary_positions is not None:
        update_data["secondary_positions"] = data.secondary_positions[:3]
    if data.unwanted_position is not None:
        update_data["unwanted_position"] = data.unwanted_position

    if update_data:
        await db.player_profiles.update_one(
            {"user_id": user["user_id"]}, {"$set": update_data}
        )

    updated = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if updated.get("birth_date"):
        updated["age"] = _calculate_age(updated["birth_date"])
    return ProfileResponse(**updated)


@router.post("/photo")
async def upload_photo(file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen no puede superar 5MB")

    # Guardamos el public_id anterior para borrarlo DESPUÉS de subir el nuevo:
    # si la subida falla, el usuario se queda con la foto que ya tenía.
    anterior = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0, "photo_public_id": 1}
    )

    # 503 y no 500: esto es "el servicio de fotos no está disponible", no "la
    # app se rompió". El mensaje va en castellano porque el front lo muestra
    # tal cual. Completar el perfil NO depende de esto: la pantalla de alta
    # guarda los datos primero y la foto después, justamente para que un fallo
    # acá no se lleve puesta el alta.
    try:
        uploaded = await upload_image_bytes(
            content=content,
            filename=file.filename or "profile.jpg",
            folder="futbol-pro/profiles",
        )
    except ImagenNoSubida as e:
        raise HTTPException(
            status_code=503,
            detail=f"{e}. Podés cargarla más tarde desde tu perfil.",
        ) from e

    await db.player_profiles.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "photo_url": uploaded["photo_url"],
                "photo_public_id": uploaded["photo_public_id"],
            }
        },
    )

    if anterior and anterior.get("photo_public_id"):
        await delete_image(anterior["photo_public_id"])

    return {"photo_url": uploaded["photo_url"]}


@router.delete("")
async def darme_de_baja(user=Depends(get_current_user)):
    """Doy de baja mi propia cuenta.

    No borra la fila: la anonimiza. Si se borrara, los partidos que esta persona
    jugó quedarían con un jugador menos y el historial de sus compañeros
    empezaría a mentir. Ver services/account.py.
    """
    resultado = await anonimizar_cuenta(user["user_id"], motivo="propia")
    if not resultado:
        raise HTTPException(status_code=404, detail="La cuenta no existe")

    return {
        "message": "Tu cuenta fue dada de baja. Tus datos personales se borraron y "
                   "los partidos que jugaste siguen contando para tus compañeros.",
    }
