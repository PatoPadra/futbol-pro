from fastapi import HTTPException

from database import db
from utils.mongo import clean_mongo


async def get_my_profile_or_404(user):
    user_id = user.get("user_id") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    raw_profile = await db.player_profiles.find_one({"user_id": user_id})
    if not raw_profile:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")

    profile = clean_mongo(raw_profile)
    if raw_profile.get("id") is None and raw_profile.get("_id") is not None:
        profile["id"] = str(raw_profile["_id"])
    elif raw_profile.get("id") is not None:
        profile["id"] = str(raw_profile["id"])

    return profile
