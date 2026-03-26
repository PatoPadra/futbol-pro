from fastapi import HTTPException

from database import db
from services.profiles import get_my_profile_or_404


async def get_match_or_404(match_id: str):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    return match


async def ensure_match_participant(match_id: str, user):
    match = await get_match_or_404(match_id)
    profile = await get_my_profile_or_404(user)

    registration = await db.match_registrations.find_one(
        {"match_id": match_id, "player_id": profile["id"], "status": {"$ne": "baja"}},
        {"_id": 0},
    )
    if not registration:
        raise HTTPException(status_code=403, detail="Solo participantes del partido pueden hacer esta acción")

    return match, profile, registration
