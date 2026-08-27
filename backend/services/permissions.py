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


async def ensure_comparte_grupo(target_player_id: str, user) -> dict:
    """Devuelve el perfil pedido sólo si quien pregunta comparte grupo con él.

    `list_players` ya restringía así, y las métricas pasan por
    `get_score_visibility_for_player`. El detalle del jugador quedó afuera y
    devolvía el documento crudo a cualquiera con sesión — y los `player_id`
    circulan por todos lados (respuestas de torneo, alineaciones, cualquier
    pantalla compartida), así que conseguir uno ajeno no requiere hacer nada
    raro.

    Ver el perfil propio siempre se puede, aunque no se comparta grupo con uno
    mismo.
    """
    profile = await db.player_profiles.find_one({"id": target_player_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    if user["role"] == "admin":
        return profile

    my_profile = await get_my_profile_or_404(user)
    if my_profile["id"] == target_player_id:
        return profile

    mis_grupos = await db.group_members.find(
        {"player_id": my_profile["id"], "status": "activo"},
        {"_id": 0, "group_id": 1},
    ).to_list(500)
    group_ids = [m["group_id"] for m in mis_grupos]

    if group_ids:
        comparte = await db.group_members.find_one(
            {
                "group_id": {"$in": group_ids},
                "player_id": target_player_id,
                "status": "activo",
            },
            {"_id": 0, "id": 1},
        )
        if comparte:
            return profile

    raise HTTPException(
        status_code=403,
        detail="Solo podés ver a jugadores de tus grupos",
    )
