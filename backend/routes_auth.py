from fastapi import APIRouter, HTTPException
from database import db
from auth import hash_password, verify_password, create_token, get_current_user
from models import RegisterRequest, LoginRequest, TokenResponse
from fastapi import Depends
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(data: RegisterRequest):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    # Check if this is the first user (make them admin)
    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 else "jugador"

    user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    user_doc = {
        "id": user_id,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "role": role,
        "created_at": now,
    }
    await db.users.insert_one(user_doc)

    profile_doc = {
        "id": profile_id,
        "user_id": user_id,
        "name": data.name,
        "email": data.email,
        "photo_url": None,
        "birth_date": None,
        "player_type": "frecuente",
        "primary_position": None,
        "secondary_positions": [],
        "unwanted_position": None,
        "matches_played": 0,
        "created_by": None,
        "estimated_level": 5.0,
        "created_at": now,
    }
    await db.player_profiles.insert_one(profile_doc)

    token = create_token(user_id, role)
    has_profile = False  # Needs to complete profile

    return TokenResponse(
        token=token,
        user_id=user_id,
        role=role,
        profile_id=profile_id,
        has_profile=has_profile,
        name=data.name,
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

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
        "profile": profile,
        "has_profile": bool(
            profile and profile.get("primary_position") and profile.get("birth_date")
        ),
    }
