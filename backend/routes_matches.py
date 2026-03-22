from fastapi import APIRouter, HTTPException, Depends, Query
from database import db
from auth import get_current_user
from models import CreateMatchRequest, UpdateMatchRequest, MatchResponse, RegistrationResponse
from constants import MODALITY_CAPACITY
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/matches", tags=["matches"])

async def get_my_profile_or_404(user):
    user_id = user.get("user_id") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    profile = await db.player_profiles.find_one(
        {"user_id": user_id}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")
    return profile


async def get_group_membership(group_id: str, player_id: str):
    return await db.group_members.find_one(
        {
            "group_id": group_id,
            "player_id": player_id,
            "status": "activo",
        },
        {"_id": 0},
    )


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
        raise HTTPException(status_code=403, detail="No perteneces al grupo de este partido")
    return membership


async def ensure_group_organizer(group_id: str, user):
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
        raise HTTPException(status_code=403, detail="No perteneces al grupo de este partido")
    if membership["member_role"] != "organizador":
        raise HTTPException(status_code=403, detail="Solo el organizador del grupo puede hacer esta acción")
    return membership



@router.post("", response_model=MatchResponse)
async def create_match(
    data: CreateMatchRequest,
    user=Depends(get_current_user)):
    if data.modality not in MODALITY_CAPACITY:
        raise HTTPException(status_code=400, detail="Modalidad inválida (5-11)")

    profile = await get_my_profile_or_404(user)

    group = await db.groups.find_one({"id": data.group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    await ensure_group_organizer(data.group_id, user)
    max_players = MODALITY_CAPACITY[data.modality]
    deadline = f"{data.date}T12:00:00+00:00"
    now = datetime.now(timezone.utc).isoformat()
    match_id = str(uuid.uuid4())

    match_doc = {
        "id": match_id,
        "group_id": data.group_id,
        "organizer_id": profile["id"],
        "title": data.title,
        "modality": data.modality,
        "date": data.date,
        "time": data.time,
        "location": data.location,
        "maps_link": data.maps_link,
        "deadline": deadline,
        "status": "abierto",
        "is_recurring": data.is_recurring,
        "max_players": max_players,
        "created_at": now,
    }
    await db.matches.insert_one(match_doc)

    return MatchResponse(
        **{k: v for k, v in match_doc.items() if k != "_id"},
        group_name=group["name"],
        my_group_role="organizador",
        organizer_name=profile["name"],
        titular_count=0,
        suplente_count=0,
    )
@router.get("")
async def list_matches(
    status: str = Query(None),
    user=Depends(get_current_user),
):
    query = {}
    profile = None
    role_by_group = {}

    if status:
        query["status"] = status

    if user["role"] != "admin":
        profile = await get_my_profile_or_404(user)

        memberships = await db.group_members.find(
            {"player_id": profile["id"], "status": "activo"},
            {"_id": 0},
        ).to_list(500)

        group_ids = [m["group_id"] for m in memberships]
        role_by_group = {m["group_id"]: m["member_role"] for m in memberships}
        query["group_id"] = {"$in": group_ids}

    matches = await db.matches.find(query, {"_id": 0}).sort("date", -1).to_list(100)

    result = []
    for m in matches:
        titular_count = await db.match_registrations.count_documents(
            {"match_id": m["id"], "status": "titular"}
        )
        suplente_count = await db.match_registrations.count_documents(
            {"match_id": m["id"], "status": "suplente"}
        )
        organizer = await db.player_profiles.find_one(
            {"id": m["organizer_id"]}, {"_id": 0}
        )
        group = await db.groups.find_one(
            {"id": m["group_id"]}, {"_id": 0}
        )

        if user["role"] == "admin":
            my_group_role = "admin"
        else:
            my_group_role = role_by_group.get(m["group_id"])

        result.append(MatchResponse(
            **m,
            group_name=group["name"] if group else None,
            my_group_role=my_group_role,
            organizer_name=organizer["name"] if organizer else "Desconocido",
            titular_count=titular_count,
            suplente_count=suplente_count,
        ))

    return result



@router.get("/{match_id}")
async def get_match(match_id: str, user=Depends(get_current_user)):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    membership = await ensure_group_member(match["group_id"], user)

    titular_count = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "titular"}
    )
    suplente_count = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "suplente"}
    )
    organizer = await db.player_profiles.find_one(
        {"id": match["organizer_id"]}, {"_id": 0}
    )
    group = await db.groups.find_one(
        {"id": match["group_id"]}, {"_id": 0}
    )

    profile = await db.player_profiles.find_one(
        {"user_id": user.get("user_id") or user.get("id")}, {"_id": 0}
    )

    my_registration = None
    if profile:
        reg = await db.match_registrations.find_one(
            {"match_id": match_id, "player_id": profile["id"], "status": {"$ne": "baja"}},
            {"_id": 0}
        )
        if reg:
            my_registration = reg

    return {
        **match,
        "group_name": group["name"] if group else None,
        "my_group_role": membership.get("member_role"),
        "organizer_name": organizer["name"] if organizer else "Desconocido",
        "titular_count": titular_count,
        "suplente_count": suplente_count,
        "my_registration": my_registration,
    }


@router.put("/{match_id}")
async def update_match(
    match_id: str,
    data: UpdateMatchRequest,
    user=Depends(get_current_user),
):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    await ensure_group_organizer(match["group_id"], user)

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.matches.update_one({"id": match_id}, {"$set": update_data})

    updated = await db.matches.find_one({"id": match_id}, {"_id": 0})
    return updated



@router.post("/{match_id}/register")
async def register_for_match(match_id: str, user=Depends(get_current_user)):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    if match["status"] != "abierto":
        raise HTTPException(status_code=400, detail="El partido no está abierto para inscripción")

    profile = await get_my_profile_or_404(user)
    await ensure_group_member(match["group_id"], user)

    existing = await db.match_registrations.find_one(
        {"match_id": match_id, "player_id": profile["id"], "status": {"$ne": "baja"}},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ya estás inscrito en este partido")

    titular_count = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "titular"}
    )

    total_regs = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": {"$ne": "baja"}}
    )

    status = "titular" if titular_count < match["max_players"] else "suplente"
    reg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    reg_doc = {
        "id": reg_id,
        "match_id": match_id,
        "player_id": profile["id"],
        "status": status,
        "order": total_regs + 1,
        "registered_at": now,
    }
    await db.match_registrations.insert_one(reg_doc)

    return {
        "id": reg_id,
        "status": status,
        "message": f"Inscrito como {'titular' if status == 'titular' else 'suplente'}",
    }

@router.post("/{match_id}/register-guest/{guest_id}")
async def register_guest_for_match(
    match_id: str, guest_id: str, user=Depends(get_current_user)
):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    await ensure_group_organizer(match["group_id"], user)

    guest = await db.player_profiles.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Jugador invitado no encontrado")
    if match["status"] != "abierto":
        raise HTTPException(status_code=400, detail="El partido no está abierto para inscripción")

    guest_membership = await db.group_members.find_one(
        {
            "group_id": match["group_id"],
            "player_id": guest_id,
            "status": "activo",
        },
        {"_id": 0}
    )
    if not guest_membership:
        raise HTTPException(status_code=400, detail="El invitado no pertenece al grupo del partido")

    existing = await db.match_registrations.find_one(
        {"match_id": match_id, "player_id": guest_id, "status": {"$ne": "baja"}},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="El jugador ya está inscrito")

    
    titular_count = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "titular"}
    )
    total_regs = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": {"$ne": "baja"}}
    )

    status = "titular" if titular_count < match["max_players"] else "suplente"
    reg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    reg_doc = {
        "id": reg_id,
        "match_id": match_id,
        "player_id": guest_id,
        "status": status,
        "order": total_regs + 1,
        "registered_at": now,
    }
    await db.match_registrations.insert_one(reg_doc)
    return {"id": reg_id, "status": status}



@router.delete("/{match_id}/register")
async def unregister_from_match(match_id: str, user=Depends(get_current_user)):
    profile = await db.player_profiles.find_one(
        {"user_id": user.get("user_id") or user.get("id")}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")

    reg = await db.match_registrations.find_one(
        {"match_id": match_id, "player_id": profile["id"], "status": {"$ne": "baja"}},
        {"_id": 0}
    )
    if not reg:
        raise HTTPException(status_code=400, detail="No estás inscrito en este partido")

    was_titular = reg["status"] == "titular"
    await db.match_registrations.update_one(
        {"id": reg["id"]}, {"$set": {"status": "baja"}}
    )

    # If was titular, promote first suplente
    if was_titular:
        first_sup = await db.match_registrations.find_one(
            {"match_id": match_id, "status": "suplente"},
            {"_id": 0},
            sort=[("order", 1)],
        )
        if first_sup:
            await db.match_registrations.update_one(
                {"id": first_sup["id"]}, {"$set": {"status": "titular"}}
            )

    return {"message": "Te has dado de baja del partido"}


@router.get("/{match_id}/registrations")
async def get_registrations(match_id: str, user=Depends(get_current_user)):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    await ensure_group_member(match["group_id"], user)

    regs = await db.match_registrations.find(
        {"match_id": match_id, "status": {"$ne": "baja"}},
        {"_id": 0}
    ).sort("order", 1).to_list(100)

    result = []
    for reg in regs:
        profile = await db.player_profiles.find_one(
            {"id": reg["player_id"]}, {"_id": 0}
        )
        if profile:
            result.append(RegistrationResponse(
                id=reg["id"],
                match_id=reg["match_id"],
                player_id=reg["player_id"],
                player_name=profile["name"],
                player_photo=profile.get("photo_url"),
                primary_position=profile.get("primary_position"),
                status=reg["status"],
                order=reg["order"],
                registered_at=reg["registered_at"],
            ))
    return result

@router.post("/{match_id}/close")
async def close_registrations(match_id: str, user=Depends(get_current_user)):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    await ensure_group_organizer(match["group_id"], user)

    await db.matches.update_one(
        {"id": match_id}, {"$set": {"status": "cerrado"}}
    )
    return {"message": "Inscripciones cerradas"}

@router.post("/{match_id}/duplicate")
async def duplicate_match(match_id: str, user=Depends(get_current_user)):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    await ensure_group_organizer(match["group_id"], user)
    profile = await get_my_profile_or_404(user)

    from datetime import timedelta
    try:
        original_date = datetime.strptime(match["date"], "%Y-%m-%d")
        next_date = original_date + timedelta(days=7)
        next_date_str = next_date.strftime("%Y-%m-%d")
    except ValueError:
        next_date_str = match["date"]

    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    deadline = f"{next_date_str}T12:00:00+00:00"

    new_match = {
        "id": new_id,
        "group_id": match["group_id"],
        "organizer_id": profile["id"],
        "title": match["title"],
        "modality": match["modality"],
        "date": next_date_str,
        "time": match["time"],
        "location": match["location"],
        "maps_link": match.get("maps_link"),
        "deadline": deadline,
        "status": "abierto",
        "is_recurring": True,
        "max_players": match["max_players"],
        "created_at": now,
    }
    await db.matches.insert_one(new_match)

    return {"id": new_id, "message": f"Partido duplicado para {next_date_str}"}