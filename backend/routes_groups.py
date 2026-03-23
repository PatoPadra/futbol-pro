from datetime import datetime, timezone
import re
import uuid

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import db
from models import (
    AddGroupMemberRequest,
    CreateGroupRequest,
    GroupSeedRatingBatchRequest,
)

router = APIRouter(prefix="/api/groups", tags=["groups"])


def clean_mongo(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {k: clean_mongo(v) for k, v in value.items() if k != "_id"}
    if isinstance(value, list):
        return [clean_mongo(item) for item in value]
    return value


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


async def get_group_or_404(group_id: str):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return clean_mongo(group)


async def get_membership(group_id: str, player_id: str):
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
    membership = await get_membership(group_id, profile["id"])
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
    return membership


async def ensure_can_manage_group(group_id: str, user):
    if user["role"] == "admin":
        profile = await get_my_profile_or_404(user)
        return {
            "player_id": profile["id"],
            "member_role": "organizador",
            "status": "activo",
        }

    profile = await get_my_profile_or_404(user)
    membership = await get_membership(group_id, profile["id"])
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
    if membership["member_role"] != "organizador":
        raise HTTPException(status_code=403, detail="Solo el organizador puede administrar el grupo")
    return membership


async def ensure_can_invite_to_group(group_id: str, user):
    if user["role"] == "admin":
        profile = await get_my_profile_or_404(user)
        return {
            "player_id": profile["id"],
            "member_role": "organizador",
            "status": "activo",
        }

    profile = await get_my_profile_or_404(user)
    membership = await get_membership(group_id, profile["id"])
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
    if membership["member_role"] != "organizador":
        raise HTTPException(status_code=403, detail="Solo el organizador puede invitar jugadores a este grupo")
    return membership


async def ensure_can_rate_group(group_id: str, user):
    if user["role"] == "admin":
        profile = await get_my_profile_or_404(user)
        return {
            "player_id": profile["id"],
            "member_role": "organizador",
            "status": "activo",
        }

    profile = await get_my_profile_or_404(user)
    membership = await get_membership(group_id, profile["id"])
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
    if membership["member_role"] not in ["organizador", "frecuente"]:
        raise HTTPException(status_code=403, detail="Solo los jugadores frecuentes u organizadores pueden calificar")
    return membership


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
        "members_count": 1,
    })


@router.get("")
async def list_groups(user=Depends(get_current_user)):
    if user["role"] == "admin":
        groups = await db.groups.find({}, {"_id": 0}).to_list(500)
        result = []
        for group in groups:
            members_count = await db.group_members.count_documents({"group_id": group["id"], "status": "activo"})
            result.append(clean_mongo({
                **group,
                "my_member_role": "admin",
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
    role_by_group = {m["group_id"]: m["member_role"] for m in memberships}

    result = []
    for group in groups:
        members_count = await db.group_members.count_documents({"group_id": group["id"], "status": "activo"})
        result.append(clean_mongo({
            **group,
            "my_member_role": role_by_group.get(group["id"]),
            "members_count": members_count,
        }))
    return result


@router.get("/{group_id}")
async def get_group(group_id: str, user=Depends(get_current_user)):
    group = await get_group_or_404(group_id)
    if user["role"] == "admin":
        my_member_role = "admin"
    else:
        membership = await ensure_group_member(group_id, user)
        my_member_role = membership.get("member_role")

    members_count = await db.group_members.count_documents({"group_id": group_id, "status": "activo"})
    return clean_mongo({
        **group,
        "my_member_role": my_member_role,
        "members_count": members_count,
    })


@router.get("/{group_id}/members")
async def list_group_members(group_id: str, user=Depends(get_current_user)):
    await get_group_or_404(group_id)
    await ensure_group_member(group_id, user)

    memberships = await db.group_members.find({"group_id": group_id, "status": "activo"}, {"_id": 0}).to_list(500)
    result = []
    for membership in memberships:
        player = await db.player_profiles.find_one({"id": membership["player_id"]}, {"_id": 0})
        row = {
            **membership,
            "player_name": player["name"] if player else "Desconocido",
            "player_email": player.get("email") if player else None,
            "player_type": player.get("player_type") if player else None,
            "primary_position": player.get("primary_position") if player else None,
            "photo_url": player.get("photo_url") if player else None,
        }
        result.append(clean_mongo(row))

    result.sort(key=lambda item: (0 if item.get("member_role") == "organizador" else 1, item.get("player_name") or ""))
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


@router.get("/{group_id}/seed-ratings")
async def get_group_seed_ratings(group_id: str, user=Depends(get_current_user)):
    await get_group_or_404(group_id)
    membership = await ensure_can_rate_group(group_id, user)

    my_ratings = await db.group_seed_ratings.find(
        {"group_id": group_id, "rater_id": membership["player_id"]},
        {"_id": 0},
    ).to_list(500)
    return clean_mongo({
        "my_ratings": my_ratings,
        "has_rated": len(my_ratings) > 0,
    })


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
