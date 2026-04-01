from fastapi import HTTPException

from database import db
from services.profiles import get_my_profile_or_404


async def get_match_or_404(match_id: str):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    return match


async def ensure_match_manager(match: dict, user, *, allow_group_organizer: bool = True):
    if user["role"] == "admin":
        return {"granted_by": "admin"}

    profile = await get_my_profile_or_404(user)
    if profile["id"] == match.get("organizer_id"):
        return {"granted_by": "match_organizer", "profile": profile}

    if allow_group_organizer:
        membership = await db.group_members.find_one(
            {
                "group_id": match["group_id"],
                "player_id": profile["id"],
                "status": "activo",
            },
            {"_id": 0},
        )
        if membership and membership.get("member_role") == "organizador":
            return {"granted_by": "group_organizer", "profile": profile, "membership": membership}

    raise HTTPException(
        status_code=403,
        detail="Solo el organizador del partido o un admin puede hacer esta acción",
    )


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
