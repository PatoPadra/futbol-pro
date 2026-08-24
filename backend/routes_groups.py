from datetime import datetime, timezone
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import db
from models import (
    AddGroupMemberRequest,
    CreateGroupRequest,
    GroupSeedRatingBatchRequest,
    MergeGuestRequest,
)
from services.guest_merge import merge_guest_into_profile
from services.permissions import (
    ensure_can_delete_group,
    ensure_can_invite_to_group,
    ensure_can_manage_group,
    ensure_can_rate_group,
    ensure_group_member,
    get_group_or_404,
)
from services.profiles import get_my_profile_or_404
from utils.mongo import clean_mongo
from services.score_visibility import get_score_visibility_for_group

router = APIRouter(prefix="/api/groups", tags=["groups"])


def normalize_global_role(role: str | None):
    if role == "admin":
        return "admin"
    if role == "organizador":
        return "organizador"
    return "jugador"


def build_group_permission(member_role: str | None):
    return "organizador" if member_role == "organizador" else "miembro"


def build_membership_type(member_role: str | None, player_type: str | None = None):
    if member_role == "invitado" or player_type == "invitado":
        return "invitado"
    return "frecuente"


async def resolve_target_player(data: AddGroupMemberRequest, inviter_profile: dict):
    if data.player_id:
        target_player = await db.player_profiles.find_one({"id": data.player_id}, {"_id": 0})
        if not target_player:
            raise HTTPException(status_code=404, detail="Jugador no encontrado")
        return target_player, data.member_role

    if data.email:
        email_value = str(data.email).lower()
        existing_user = await db.users.find_one({"email": email_value}, {"_id": 0})
        if existing_user:
            target_player = await db.player_profiles.find_one({"user_id": existing_user["id"]}, {"_id": 0})
            if target_player:
                return target_player, data.member_role

        existing_profile = await db.player_profiles.find_one({"email": email_value}, {"_id": 0})
        if existing_profile:
            return existing_profile, data.member_role

    lookup_name = (data.username or data.name or "").strip()
    if lookup_name:
        exact_regex = re.compile(rf"^{re.escape(lookup_name)}$", re.IGNORECASE)
        candidates = await db.player_profiles.find({"name": exact_regex}, {"_id": 0}).to_list(10)
        if len(candidates) == 1:
            return candidates[0], data.member_role
        if len(candidates) > 1:
            raise HTTPException(
                status_code=400,
                detail="Hay más de un jugador con ese nombre. Usa email para invitarlo sin ambigüedad",
            )

    guest_name = (data.name or data.username or "").strip()
    if not guest_name:
        raise HTTPException(
            status_code=400,
            detail="Debes enviar player_id, email o nombre de usuario/nombre",
        )

    now = datetime.now(timezone.utc).isoformat()
    guest_id = str(uuid.uuid4())
    target_player = {
        "id": guest_id,
        "user_id": None,
        "name": guest_name,
        "email": str(data.email).lower() if data.email else None,
        "photo_url": None,
        "birth_date": None,
        "gender": data.gender,
        "player_type": "invitado",
        "primary_position": None,
        "secondary_positions": [],
        "unwanted_position": None,
        "matches_played": 0,
        "created_by": inviter_profile["id"],
        "estimated_level": 5.0,
        "created_at": now,
    }
    await db.player_profiles.insert_one(target_player)
    return target_player, "invitado"


@router.post("")
async def create_group(data: CreateGroupRequest, user=Depends(get_current_user)):
    if user["role"] not in ["admin", "organizador"]:
        raise HTTPException(status_code=403, detail="Solo organizadores o admins pueden crear grupos")

    profile = await get_my_profile_or_404(user)
    now = datetime.now(timezone.utc).isoformat()
    group_id = str(uuid.uuid4())

    group_doc = {
        "id": group_id,
        "name": data.name.strip(),
        "created_by": profile["id"],
        "created_at": now,
    }
    await db.groups.insert_one(group_doc)

    member_doc = {
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "player_id": profile["id"],
        "member_role": "organizador",
        "status": "activo",
        "invited_by": profile["id"],
        "created_at": now,
    }
    await db.group_members.insert_one(member_doc)

    return clean_mongo({
        **group_doc,
        "my_member_role": "organizador",
        "my_group_permission": "organizador",
        "my_membership_type": "frecuente",
        "my_global_role": normalize_global_role(user.get("role")),
        "can_manage": True,
        "can_invite": True,
        "can_rate_seed": True,
        "members_count": 1,
    })


async def _contar_miembros_activos(group_ids: list) -> dict:
    """
    Un solo aggregate en vez de un count_documents por grupo. Los grupos sin
    miembros activos no aparecen en el resultado, por eso quien lo consume usa
    .get(id, 0) y no indexado directo.
    """
    if not group_ids:
        return {}
    cursor = db.group_members.aggregate([
        {"$match": {"group_id": {"$in": group_ids}, "status": "activo"}},
        {"$group": {"_id": "$group_id", "total": {"$sum": 1}}},
    ])
    return {row["_id"]: row["total"] async for row in cursor}


@router.get("")
async def list_groups(user=Depends(get_current_user)):
    if user["role"] == "admin":
        groups = await db.groups.find({}, {"_id": 0}).to_list(500)
        counts = await _contar_miembros_activos([g["id"] for g in groups])
        result = []
        for group in groups:
            members_count = counts.get(group["id"], 0)
            result.append(clean_mongo({
                **group,
                "my_member_role": "admin",
                "my_group_permission": "organizador",
                "my_membership_type": "frecuente",
                "my_global_role": "admin",
                "can_manage": True,
                "can_invite": True,
                "can_rate_seed": True,
                "members_count": members_count,
            }))
        return result

    profile = await get_my_profile_or_404(user)
    memberships = await db.group_members.find(
        {"player_id": profile["id"], "status": "activo"},
        {"_id": 0},
    ).to_list(500)

    group_ids = [m["group_id"] for m in memberships]
    groups = await db.groups.find({"id": {"$in": group_ids}}, {"_id": 0}).to_list(500)
    membership_by_group = {m["group_id"]: m for m in memberships}

    counts = await _contar_miembros_activos([g["id"] for g in groups])

    result = []
    for group in groups:
        membership = membership_by_group.get(group["id"])
        member_role = membership.get("member_role") if membership else None
        members_count = counts.get(group["id"], 0)

        result.append(clean_mongo({
            **group,
            "my_member_role": member_role,
            "my_group_permission": build_group_permission(member_role),
            "my_membership_type": build_membership_type(member_role, profile.get("player_type")),
            "my_global_role": normalize_global_role(user.get("role")),
            "can_manage": member_role == "organizador",
            "can_invite": member_role == "organizador",
            "can_rate_seed": member_role in ["organizador", "frecuente"],
            "members_count": members_count,
        }))
    return result


@router.get("/{group_id}")
async def get_group(group_id: str, user=Depends(get_current_user)):
    group = await get_group_or_404(group_id)

    if user["role"] == "admin":
        my_member_role = "admin"
        my_group_permission = "organizador"
        my_membership_type = "frecuente"
        can_manage = True
        can_invite = True
        can_rate_seed = True
    else:
        profile = await get_my_profile_or_404(user)
        membership = await ensure_group_member(group_id, user)
        member_role = membership.get("member_role")

        my_member_role = member_role
        my_group_permission = build_group_permission(member_role)
        my_membership_type = build_membership_type(member_role, profile.get("player_type"))
        can_manage = member_role == "organizador"
        can_invite = member_role == "organizador"
        can_rate_seed = member_role in ["organizador", "frecuente"]

    members_count = await db.group_members.count_documents({"group_id": group_id, "status": "activo"})

    return clean_mongo({
        **group,
        "my_member_role": my_member_role,
        "my_group_permission": my_group_permission,
        "my_membership_type": my_membership_type,
        "my_global_role": normalize_global_role(user.get("role")),
        "can_manage": can_manage,
        "can_invite": can_invite,
        "can_rate_seed": can_rate_seed,
        "members_count": members_count,
    })


@router.get("/{group_id}/members")
async def list_group_members(group_id: str, user=Depends(get_current_user)):
    await get_group_or_404(group_id)
    await ensure_group_member(group_id, user)

    memberships = await db.group_members.find({"group_id": group_id, "status": "activo"}, {"_id": 0}).to_list(500)
    if not memberships:
        return []

    player_ids = [membership["player_id"] for membership in memberships]
    players = await db.player_profiles.find({"id": {"$in": player_ids}}, {"_id": 0}).to_list(500)
    player_map = {player["id"]: player for player in players}

    user_ids = [player["user_id"] for player in players if player.get("user_id")]
    linked_users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0}).to_list(500) if user_ids else []
    user_map = {linked_user["id"]: linked_user for linked_user in linked_users}

    inviter_ids = list({membership.get("invited_by") for membership in memberships if membership.get("invited_by")})
    inviters = await db.player_profiles.find({"id": {"$in": inviter_ids}}, {"_id": 0}).to_list(500) if inviter_ids else []
    inviter_map = {inviter["id"]: inviter for inviter in inviters}

    result = []
    for membership in memberships:
        player = player_map.get(membership["player_id"])

        global_role = "jugador"
        if player and player.get("user_id"):
            linked_user = user_map.get(player["user_id"])
            global_role = normalize_global_role(linked_user.get("role") if linked_user else None)

        member_role = membership.get("member_role")
        row = {
            **membership,
            "player_name": player["name"] if player else "Desconocido",
            "player_email": player.get("email") if player else None,
            "player_type": player.get("player_type") if player else None,
            "gender": player.get("gender") if player else None,
            "primary_position": player.get("primary_position") if player else None,
            "photo_url": player.get("photo_url") if player else None,
            "group_permission": build_group_permission(member_role),
            "membership_type": build_membership_type(member_role, player.get("player_type") if player else None),
            "global_role": global_role,
            "is_system_admin": global_role == "admin",
            "invited_by_name": inviter_map.get(membership.get("invited_by"), {}).get("name") if membership.get("invited_by") else None,
        }
        result.append(clean_mongo(row))

    result.sort(
        key=lambda item: (
            0 if item.get("group_permission") == "organizador" else 1,
            0 if item.get("membership_type") == "frecuente" else 1,
            item.get("player_name") or "",
        )
    )
    return result


@router.post("/{group_id}/members")
async def add_group_member(group_id: str, data: AddGroupMemberRequest, user=Depends(get_current_user)):
    await get_group_or_404(group_id)
    await ensure_can_invite_to_group(group_id, user)
    my_profile = await get_my_profile_or_404(user)

    target_player, final_member_role = await resolve_target_player(data, my_profile)

    existing = await db.group_members.find_one(
        {"group_id": group_id, "player_id": target_player["id"]},
        {"_id": 0},
    )
    if existing and existing.get("status") == "activo":
        raise HTTPException(status_code=400, detail="Ese jugador ya pertenece al grupo")

    now = datetime.now(timezone.utc).isoformat()
    if existing:
        await db.group_members.update_one(
            {"id": existing["id"]},
            {"$set": {
                "member_role": final_member_role,
                "status": "activo",
                "invited_by": my_profile["id"],
                "updated_at": now,
            }},
        )
        member_id = existing["id"]
        created_at_value = existing.get("created_at")
    else:
        member_id = str(uuid.uuid4())
        member_doc = {
            "id": member_id,
            "group_id": group_id,
            "player_id": target_player["id"],
            "member_role": final_member_role,
            "status": "activo",
            "invited_by": my_profile["id"],
            "created_at": now,
        }
        await db.group_members.insert_one(member_doc)
        created_at_value = now

    return clean_mongo({
        "id": member_id,
        "group_id": group_id,
        "player_id": target_player["id"],
        "player_name": target_player["name"],
        "player_email": target_player.get("email"),
        "member_role": final_member_role,
        "group_permission": build_group_permission(final_member_role),
        "membership_type": build_membership_type(final_member_role, target_player.get("player_type")),
        "status": "activo",
        "invited_by": my_profile["id"],
        "created_at": created_at_value,
    })


@router.patch("/{group_id}/members/{member_id}")
async def update_group_member(group_id: str, member_id: str, data: dict, user=Depends(get_current_user)):
    await get_group_or_404(group_id)
    await ensure_can_manage_group(group_id, user)

    member = await db.group_members.find_one({"id": member_id, "group_id": group_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")

    allowed_roles = ["organizador", "frecuente", "invitado"]
    allowed_status = ["activo", "inactivo"]

    update_data = {}
    if "member_role" in data:
        if data["member_role"] not in allowed_roles:
            raise HTTPException(status_code=400, detail="member_role inválido")
        update_data["member_role"] = data["member_role"]

    if "status" in data:
        if data["status"] not in allowed_status:
            raise HTTPException(status_code=400, detail="status inválido")
        update_data["status"] = data["status"]

    if not update_data:
        raise HTTPException(status_code=400, detail="No hay cambios para aplicar")

    await db.group_members.update_one({"id": member_id}, {"$set": update_data})
    updated = await db.group_members.find_one({"id": member_id}, {"_id": 0})
    return clean_mongo(updated)


@router.delete("/{group_id}/members/{member_id}")
async def remove_group_member(group_id: str, member_id: str, user=Depends(get_current_user)):
    await get_group_or_404(group_id)
    await ensure_can_manage_group(group_id, user)

    member = await db.group_members.find_one({"id": member_id, "group_id": group_id, "status": "activo"}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")

    actor_profile = await get_my_profile_or_404(user)
    if user["role"] != "admin" and member["player_id"] == actor_profile["id"]:
        raise HTTPException(status_code=400, detail="No puedes quitarte a ti mismo desde aquí")

    if member.get("member_role") == "organizador":
        organizers_count = await db.group_members.count_documents(
            {"group_id": group_id, "status": "activo", "member_role": "organizador"}
        )
        if organizers_count <= 1:
            raise HTTPException(status_code=400, detail="No puedes quitar al último organizador del grupo")

    now = datetime.now(timezone.utc).isoformat()
    await db.group_members.update_one(
        {"id": member_id},
        {"$set": {"status": "inactivo", "updated_at": now}},
    )

    active_match_statuses = ["abierto", "cerrado", "equipos_generados", "equipos_confirmados"]
    active_matches = await db.matches.find(
        {"group_id": group_id, "status": {"$in": active_match_statuses}},
        {"_id": 0, "id": 1, "status": 1},
    ).to_list(500)

    # Las registraciones del jugador en todos los partidos activos, de una sola
    # query en vez de un find_one por partido. Las escrituras de abajo quedan por
    # partido a propósito: son condicionales (sólo corren donde estaba anotado) y
    # la promoción del suplente depende del orden.
    regs_activas = await db.match_registrations.find(
        {
            "match_id": {"$in": [m["id"] for m in active_matches]},
            "player_id": member["player_id"],
            "status": {"$ne": "baja"},
        },
        {"_id": 0},
    ).to_list(len(active_matches) or 1)
    reg_by_match = {r["match_id"]: r for r in regs_activas}

    for match in active_matches:
        reg = reg_by_match.get(match["id"])
        if not reg:
            continue

        was_titular = reg.get("status") == "titular"
        await db.match_registrations.update_one(
            {"id": reg["id"]},
            {"$set": {"status": "baja", "removed_by": actor_profile["id"], "removed_at": now, "removed_reason": "removed_from_group"}},
        )

        if was_titular:
            first_sup = await db.match_registrations.find_one(
                {"match_id": match["id"], "status": "suplente"},
                {"_id": 0},
                sort=[("order", 1)],
            )
            if first_sup:
                await db.match_registrations.update_one(
                    {"id": first_sup["id"]}, {"$set": {"status": "titular"}}
                )

        if match.get("status") in ["equipos_generados", "equipos_confirmados"]:
            await db.team_generations.delete_many({"match_id": match["id"]})
            await db.matches.update_one(
                {"id": match["id"]},
                {"$set": {"status": "cerrado", "updated_at": now}},
            )

    return {"message": "Jugador quitado del grupo", "member_id": member_id}


@router.get("/{group_id}/seed-ratings")
async def get_group_seed_ratings(group_id: str, user=Depends(get_current_user)):
    await get_group_or_404(group_id)
    membership = await ensure_can_rate_group(group_id, user)
    visibility = await get_score_visibility_for_group(group_id, user)

    my_ratings = await db.group_seed_ratings.find(
        {"group_id": group_id, "rater_id": membership["player_id"]},
        {"_id": 0},
    ).to_list(500)
    response = clean_mongo({
        "my_ratings": my_ratings,
        "has_rated": len(my_ratings) > 0,
        "can_view_all_scores": visibility["can_view_all_scores"],
        "score_visibility_scope": visibility["scope"],
    })

    if visibility["can_view_all_scores"]:
        all_seed_ratings = await db.group_seed_ratings.find({"group_id": group_id}, {"_id": 0}).to_list(1000)
        response["all_seed_ratings"] = clean_mongo(all_seed_ratings)

    return response


@router.post("/{group_id}/seed-ratings")
async def submit_group_seed_ratings(group_id: str, data: GroupSeedRatingBatchRequest, user=Depends(get_current_user)):
    await get_group_or_404(group_id)
    membership = await ensure_can_rate_group(group_id, user)
    rater_id = membership["player_id"]

    memberships = await db.group_members.find({"group_id": group_id, "status": "activo"}, {"_id": 0}).to_list(500)
    member_by_player = {m["player_id"]: m for m in memberships}

    valid_ratings = []
    for rating in data.ratings:
        if rating.score < 1 or rating.score > 10:
            continue
        if rating.rated_player_id == rater_id:
            continue

        target_member = member_by_player.get(rating.rated_player_id)
        if not target_member:
            raise HTTPException(status_code=400, detail="Jugador inválido para este grupo")

        target_role = target_member.get("member_role")
        is_core_member = target_role in ["organizador", "frecuente"]
        is_my_invited_guest = target_role == "invitado" and target_member.get("invited_by") == rater_id

        if not (is_core_member or is_my_invited_guest):
            raise HTTPException(
                status_code=400,
                detail="Solo puedes calificar jugadores frecuentes/organizadores del grupo y, en el caso de invitados, únicamente a los que invitaste tú",
            )

        valid_ratings.append(rating)

    if not valid_ratings:
        raise HTTPException(status_code=400, detail="No hay evaluaciones válidas para guardar")

    now = datetime.now(timezone.utc).isoformat()
    await db.group_seed_ratings.delete_many({"group_id": group_id, "rater_id": rater_id})

    for rating in valid_ratings:
        await db.group_seed_ratings.insert_one({
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "rater_id": rater_id,
            "rated_player_id": rating.rated_player_id,
            "score": rating.score,
            "created_at": now,
        })

    return {"message": "Puntajes iniciales guardados"}


@router.post("/{group_id}/members/{member_id}/merge-guest")
async def merge_guest_member(group_id: str, member_id: str, data: MergeGuestRequest, user=Depends(get_current_user)):
    await get_group_or_404(group_id)
    await ensure_can_manage_group(group_id, user)

    target_membership = await db.group_members.find_one(
        {"id": member_id, "group_id": group_id, "status": "activo"}, {"_id": 0}
    )
    if not target_membership:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")

    if data.guest_player_id == target_membership["player_id"]:
        raise HTTPException(status_code=400, detail="No podés vincular un miembro consigo mismo")

    target_profile = await db.player_profiles.find_one({"id": target_membership["player_id"]}, {"_id": 0})
    if not target_profile or not target_profile.get("user_id"):
        raise HTTPException(status_code=400, detail="Solo podés vincular un invitado con un miembro que tenga cuenta propia")

    guest_membership = await db.group_members.find_one(
        {
            "group_id": group_id,
            "player_id": data.guest_player_id,
            "status": "activo",
            "member_role": "invitado",
        },
        {"_id": 0},
    )
    if not guest_membership:
        raise HTTPException(status_code=400, detail="El invitado no pertenece a este grupo")

    merged = await merge_guest_into_profile(data.guest_player_id, target_membership["player_id"])
    if not merged:
        raise HTTPException(status_code=400, detail="Ese invitado ya no está disponible para vincular")

    return {"message": f"{merged['name']} fue vinculado a {target_profile['name']}"}


@router.delete("/{group_id}")
async def delete_group(group_id: str, user=Depends(get_current_user)):
    await ensure_can_delete_group(group_id, user)

    match_ids = [
        m["id"]
        for m in await db.matches.find({"group_id": group_id}, {"_id": 0, "id": 1}).to_list(2000)
    ]

    if match_ids:
        await db.match_registrations.delete_many({"match_id": {"$in": match_ids}})
        await db.team_generations.delete_many({"match_id": {"$in": match_ids}})
        await db.peer_ratings.delete_many({"match_id": {"$in": match_ids}})
        await db.self_evaluations.delete_many({"match_id": {"$in": match_ids}})
        await db.stats_final.delete_many({"match_id": {"$in": match_ids}})
        await db.stats_proposals.delete_many({"match_id": {"$in": match_ids}})
        await db.matches.delete_many({"group_id": group_id})

    await db.group_members.delete_many({"group_id": group_id})
    await db.group_seed_ratings.delete_many({"group_id": group_id})
    await db.groups.delete_one({"id": group_id})

    return {"message": "Grupo eliminado", "group_id": group_id, "matches_deleted": len(match_ids)}