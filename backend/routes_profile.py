from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from database import db
from auth import get_current_user
from models import ProfileUpdate, ProfileResponse
from datetime import datetime, timezone
import uuid
import os
from pathlib import Path

router = APIRouter(prefix="/api/profile", tags=["profile"])
UPLOAD_DIR = Path(__file__).parent / "uploads"


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

    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = UPLOAD_DIR / filename

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen no puede superar 5MB")

    with open(filepath, "wb") as f:
        f.write(content)

    photo_url = f"/api/uploads/{filename}"
    await db.player_profiles.update_one(
        {"user_id": user["user_id"]}, {"$set": {"photo_url": photo_url}}
    )

    return {"photo_url": photo_url}
