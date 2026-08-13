from fastapi import HTTPException

from database import db
from services.profiles import get_my_profile_or_404
from utils.mongo import clean_mongo


async def get_group_or_404(group_id: str):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return clean_mongo(group)


async def get_group_membership(group_id: str, player_id: str):
    membership = await db.group_members.find_one(
        {
            "group_id": group_id,
            "player_id": player_id,
            "status": "activo",
        }
    )
    return clean_mongo(membership) if membership else None


async def ensure_group_member(group_id: str, user):
    if user["role"] == "admin":
        profile = await get_my_profile_or_404(user)
        return {
            "player_id": profile["id"],
            "member_role": "organizador",
            "status": "activo",
        }

    profile = await get_my_profile_or_404(user)
    membership = await get_group_membership(group_id, profile["id"])
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
    return membership


async def ensure_group_organizer(group_id: str, user):
    membership = await ensure_group_member(group_id, user)
    if user["role"] != "admin" and membership.get("member_role") != "organizador":
        raise HTTPException(status_code=403, detail="Solo el organizador puede hacer esta acción")
    return membership


async def ensure_can_manage_group(group_id: str, user):
    membership = await ensure_group_member(group_id, user)
    if user["role"] != "admin" and membership.get("member_role") != "organizador":
        raise HTTPException(status_code=403, detail="Solo el organizador puede administrar el grupo")
    return membership


async def ensure_can_invite_to_group(group_id: str, user):
    membership = await ensure_group_member(group_id, user)
    if user["role"] != "admin" and membership.get("member_role") != "organizador":
        raise HTTPException(status_code=403, detail="Solo el organizador puede invitar jugadores a este grupo")
    return membership


async def ensure_can_rate_group(group_id: str, user):
    membership = await ensure_group_member(group_id, user)
    if user["role"] != "admin" and membership.get("member_role") not in ["organizador", "frecuente"]:
        raise HTTPException(status_code=403, detail="Solo los jugadores frecuentes u organizadores pueden calificar")
    return membership


async def ensure_can_delete_group(group_id: str, user):
    group = await get_group_or_404(group_id)
    if user["role"] == "admin":
        return group

    membership = await ensure_group_member(group_id, user)
    if membership.get("member_role") != "organizador":
        raise HTTPException(status_code=403, detail="Solo el organizador puede borrar el grupo")

    profile = await get_my_profile_or_404(user)
    if group.get("created_by") != profile["id"]:
        raise HTTPException(status_code=403, detail="Solo quien creó el grupo puede borrarlo")

    return group
