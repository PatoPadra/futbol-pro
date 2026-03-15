from fastapi import APIRouter, HTTPException, Depends, Query
from database import db
from auth import get_current_user, require_roles
from models import CreateMatchRequest, UpdateMatchRequest, MatchResponse, RegistrationResponse
from constants import MODALITY_CAPACITY
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.post("", response_model=MatchResponse)
async def create_match(
    data: CreateMatchRequest,
    user=Depends(require_roles(["admin", "organizador"]))
):
    if data.modality not in MODALITY_CAPACITY:
        raise HTTPException(status_code=400, detail="Modalidad inválida (5-11)")

    profile = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")

    max_players = MODALITY_CAPACITY[data.modality]
    # Deadline: match day at noon
    deadline = f"{data.date}T12:00:00+00:00"
    now = datetime.now(timezone.utc).isoformat()
    match_id = str(uuid.uuid4())

    match_doc = {
        "id": match_id,
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
    if status:
        query["status"] = status

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
        result.append(MatchResponse(
            **m,
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

    titular_count = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "titular"}
    )
    suplente_count = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "suplente"}
    )
    organizer = await db.player_profiles.find_one(
        {"id": match["organizer_id"]}, {"_id": 0}
    )

    # Get user's registration status
    profile = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
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

    # Only organizer or admin can update
    profile = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if user["role"] != "admin" and (not profile or profile["id"] != match["organizer_id"]):
        raise HTTPException(status_code=403, detail="Solo el organizador puede editar")

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

    profile = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")

    # Check if already registered
    existing = await db.match_registrations.find_one(
        {"match_id": match_id, "player_id": profile["id"], "status": {"$ne": "baja"}},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ya estás inscrito en este partido")

    # Count current titulars
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

    guest = await db.player_profiles.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Jugador invitado no encontrado")

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
        {"user_id": user["user_id"]}, {"_id": 0}
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

    profile = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if user["role"] != "admin" and (not profile or profile["id"] != match["organizer_id"]):
        raise HTTPException(status_code=403, detail="Solo el organizador puede cerrar inscripciones")

    await db.matches.update_one(
        {"id": match_id}, {"$set": {"status": "cerrado"}}
    )
    return {"message": "Inscripciones cerradas"}


@router.post("/{match_id}/duplicate")
async def duplicate_match(match_id: str, user=Depends(get_current_user)):
    """Duplicate a match for the next week (recurring)."""
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    profile = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if user["role"] not in ["admin", "organizador"]:
        raise HTTPException(status_code=403, detail="Solo organizadores pueden duplicar partidos")

    # Calculate next week's date
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
        "organizer_id": profile["id"] if profile else match["organizer_id"],
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
