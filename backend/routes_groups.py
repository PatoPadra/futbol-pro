from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import get_current_user
from models import CreateGroupRequest, AddGroupMemberRequest
from datetime import datetime, timezone
from bson import ObjectId
import uuid

router = APIRouter(prefix="/api/groups", tags=["groups"])


def clean_mongo(value):
    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, dict):
        return {
            k: clean_mongo(v)
            for k, v in value.items()
            if k != "_id"
        }

    if isinstance(value, list):
        return [clean_mongo(v) for v in value]

    return value


async def get_my_profile_or_404(user):
    user_id = user.get("user_id") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    profile = await db.player_profiles.find_one({"user_id": user_id})
    if not profile:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")

    raw_profile_id = profile.get("id") or profile.get("_id")
    profile = clean_mongo(profile)
    profile["id"] = str(raw_profile_id) if raw_profile_id is not None else None

    if not profile.get("id"):
        raise HTTPException(status_code=400, detail="Perfil inválido: falta id")

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
    profile = await get_my_profile_or_404(user)

    if user["role"] == "admin":
        return {
            "player_id": profile["id"],
            "member_role": "organizador",
            "status": "activo",
        }

    membership = await get_membership(group_id, profile["id"])
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
    return membership


async def ensure_can_manage_group(group_id: str, user):
    profile = await get_my_profile_or_404(user)

    if user["role"] == "admin":
        return {
            "player_id": profile["id"],
            "member_role": "organizador",
            "status": "activo",
        }

    membership = await get_membership(group_id, profile["id"])
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")

    if membership["member_role"] != "organizador":
        raise HTTPException(status_code=403, detail="Solo el organizador puede administrar el grupo")

    return membership


async def ensure_can_invite_to_group(group_id: str, user):
    profile = await get_my_profile_or_404(user)

    if user["role"] == "admin":
        return {
            "player_id": profile["id"],
            "member_role": "organizador",
            "status": "activo",
        }

    membership = await get_membership(group_id, profile["id"])
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")

    if membership["member_role"] not in ["organizador", "frecuente"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para invitar en este grupo")

    return membership


@router.post("")
async def create_group(
    data: CreateGroupRequest,
    user=Depends(get_current_user),
):
    profile = await get_my_profile_or_404(user)
    profile_id = str(profile["id"])

    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nombre de grupo inválido")

    now = datetime.now(timezone.utc).isoformat()
    group_id = str(uuid.uuid4())

    group_doc = {
        "id": group_id,
        "name": name,
        "created_by": profile_id,
        "created_at": now,
    }
    await db.groups.insert_one(group_doc)

    member_doc = {
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "player_id": profile_id,
        "member_role": "organizador",
        "status": "activo",
        "invited_by": profile_id,
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
        groups = await db.groups.find({}).to_list(500)
        result = []

        for group in groups:
            group = clean_mongo(group)
            members_count = await db.group_members.count_documents(
                {"group_id": group["id"], "status": "activo"}
            )
            result.append(clean_mongo({
                **group,
                "my_member_role": "admin",
                "members_count": members_count,
            }))

        return result

    profile = await get_my_profile_or_404(user)

    memberships = await db.group_members.find(
        {"player_id": profile["id"], "status": "activo"}
    ).to_list(500)
    memberships = clean_mongo(memberships)

    group_ids = [m["group_id"] for m in memberships]
    groups = await db.groups.find({"id": {"$in": group_ids}}).to_list(500)
    groups = clean_mongo(groups)

    role_by_group = {m["group_id"]: m["member_role"] for m in memberships}

    result = []
    for group in groups:
        members_count = await db.group_members.count_documents(
            {"group_id": group["id"], "status": "activo"}
        )
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

    members_count = await db.group_members.count_documents(
        {"group_id": group_id, "status": "activo"}
    )

    return clean_mongo({
        **group,
        "my_member_role": my_member_role,
        "members_count": members_count,
    })


@router.get("/{group_id}/members")
async def list_group_members(group_id: str, user=Depends(get_current_user)):
    await get_group_or_404(group_id)
    await ensure_group_member(group_id, user)

    memberships = await db.group_members.find(
        {"group_id": group_id, "status": "activo"}
    ).to_list(500)
    memberships = clean_mongo(memberships)

    result = []
    for membership in memberships:
        player = await db.player_profiles.find_one({"id": membership["player_id"]})
        if player:
            raw_player_id = player.get("id") or player.get("_id")
            player = clean_mongo(player)
            player["id"] = str(raw_player_id) if raw_player_id is not None else None

        result.append(clean_mongo({
            **membership,
            "player_name": player["name"] if player else "Desconocido",
            "player_email": player.get("email") if player else None,
            "player_type": player.get("player_type") if player else None,
            "primary_position": player.get("primary_position") if player else None,
            "photo_url": player.get("photo_url") if player else None,
        }))

    return result


@router.post("/{group_id}/members")
async def add_group_member(
    group_id: str,
    data: AddGroupMemberRequest,
    user=Depends(get_current_user),
):
    await get_group_or_404(group_id)
    inviter_membership = await ensure_can_invite_to_group(group_id, user)
    my_profile = await get_my_profile_or_404(user)
    my_profile_id = str(my_profile["id"])

    target_player = None
    final_member_role = data.member_role

    if data.player_id:
        target_player = await db.player_profiles.find_one({"id": data.player_id})
        if not target_player:
            raise HTTPException(status_code=404, detail="Jugador no encontrado")

        raw_target_id = target_player.get("id") or target_player.get("_id")
        target_player = clean_mongo(target_player)
        target_player["id"] = str(raw_target_id) if raw_target_id is not None else None
    else:
        if not data.name:
            raise HTTPException(status_code=400, detail="Debes enviar player_id o name")

        now = datetime.now(timezone.utc).isoformat()
        guest_id = str(uuid.uuid4())

        target_player = {
            "id": guest_id,
            "user_id": None,
            "name": data.name.strip(),
            "email": data.email,
            "photo_url": None,
            "birth_date": None,
            "player_type": "invitado",
            "primary_position": None,
            "secondary_positions": [],
            "unwanted_position": None,
            "matches_played": 0,
            "created_by": my_profile_id,
            "estimated_level": 5.0,
            "created_at": now,
        }
        await db.player_profiles.insert_one(target_player)

        # Si se crea manualmente por nombre/email, siempre entra como invitado
        final_member_role = "invitado"

    if not target_player.get("id"):
        raise HTTPException(status_code=400, detail="Jugador inválido: falta id")

    # Regla: frecuente solo puede invitar invitados
    if inviter_membership["member_role"] == "frecuente" and final_member_role != "invitado":
        raise HTTPException(status_code=403, detail="Un jugador frecuente solo puede invitar invitados")

    existing = await db.group_members.find_one(
        {
            "group_id": group_id,
            "player_id": target_player["id"],
        }
    )
    existing = clean_mongo(existing) if existing else None

    if existing and existing.get("status") == "activo":
        raise HTTPException(status_code=400, detail="Ese jugador ya pertenece al grupo")

    now = datetime.now(timezone.utc).isoformat()

    if existing:
        await db.group_members.update_one(
            {"id": existing["id"]},
            {
                "$set": {
                    "member_role": final_member_role,
                    "status": "activo",
                    "invited_by": my_profile_id,
                    "updated_at": now,
                }
            },
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
            "invited_by": my_profile_id,
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
        "invited_by": my_profile_id,
        "created_at": created_at_value,
    })


@router.patch("/{group_id}/members/{member_id}")
async def update_group_member(
    group_id: str,
    member_id: str,
    data: dict,
    user=Depends(get_current_user),
):
    await get_group_or_404(group_id)
    await ensure_can_manage_group(group_id, user)

    member = await db.group_members.find_one(
        {"id": member_id, "group_id": group_id}
    )
    member = clean_mongo(member) if member else None

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

    await db.group_members.update_one(
        {"id": member_id},
        {"$set": update_data},
    )

    updated = await db.group_members.find_one({"id": member_id})
    return clean_mongo(updated)