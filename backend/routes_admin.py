from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import require_roles
from models import UpdateRoleRequest
from datetime import datetime, timezone
import random
import uuid

from constants import POSITION_IDS



router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
async def list_users(user=Depends(require_roles(["admin"]))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    for u in users:
        profile = await db.player_profiles.find_one(
            {"user_id": u["id"]}, {"_id": 0}
        )
        u["profile"] = profile
    return users


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    data: UpdateRoleRequest,
    user=Depends(require_roles(["admin"])),
):
    if data.role not in ["admin", "organizador", "jugador"]:
        raise HTTPException(status_code=400, detail="Rol inválido")

    existing = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    await db.users.update_one({"id": user_id}, {"$set": {"role": data.role}})
    return {"message": f"Rol actualizado a {data.role}"}


@router.get("/matches")
async def admin_list_matches(user=Depends(require_roles(["admin"]))):
    matches = await db.matches.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return matches


@router.get("/stats")
async def admin_stats(user=Depends(require_roles(["admin"]))):
    total_users = await db.users.count_documents({})
    total_matches = await db.matches.count_documents({})
    total_profiles = await db.player_profiles.count_documents({})
    guests = await db.player_profiles.count_documents({"player_type": "invitado"})
    active_matches = await db.matches.count_documents({"status": {"$in": ["abierto", "cerrado", "equipos_generados", "equipos_confirmados"]}})
    completed_matches = await db.matches.count_documents({"status": "completado"})

    return {
        "total_users": total_users,
        "total_matches": total_matches,
        "total_profiles": total_profiles,
        "guest_players": guests,
        "active_matches": active_matches,
        "completed_matches": completed_matches,
    }


@router.post("/matches/{match_id}/seed-test-players")
async def seed_test_players_for_match(
    match_id: str,
    qty: int = 22,
    member_role: str = "frecuente",
    user=Depends(require_roles(["admin"])),
):
    if qty < 1 or qty > 60:
        raise HTTPException(status_code=400, detail="qty debe estar entre 1 y 60")

    if member_role not in ["frecuente", "invitado", "organizador"]:
        raise HTTPException(status_code=400, detail="member_role inválido")

    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    group = await db.groups.find_one({"id": match["group_id"]}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    organizer_profile = await db.player_profiles.find_one(
        {"id": match["organizer_id"]}, {"_id": 0}
    )
    if not organizer_profile:
        raise HTTPException(status_code=404, detail="Organizador no encontrado")

    now = datetime.now(timezone.utc).isoformat()

    existing_active_regs = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": {"$ne": "baja"}}
    )

    created_players = []
    created_registrations = []

    # Base de posiciones bastante realista para 11v11.
    base_positions_11 = [
        "GK",
        "RB", "CB", "CB", "LB",
        "CDM", "RM", "LM", "CAM",
        "RW", "LW", "ST"
    ]

    position_pool = []
    while len(position_pool) < qty:
        position_pool.extend(base_positions_11)

    position_pool = position_pool[:qty]
    random.shuffle(position_pool)

    for i in range(qty):
        player_id = str(uuid.uuid4())
        reg_id = str(uuid.uuid4())
        pos = position_pool[i]

        level = round(random.uniform(4.0, 8.5), 1)

        # secundarias simples para que el balanceador tenga algo más de contexto
        secondary_positions = []
        if pos == "CB":
            secondary_positions = ["LB", "RB"]
        elif pos in ["LB", "RB"]:
            secondary_positions = ["CB"]
        elif pos == "CDM":
            secondary_positions = ["CAM"]
        elif pos in ["RM", "LM"]:
            secondary_positions = ["RW", "LW"]
        elif pos == "CAM":
            secondary_positions = ["CDM", "ST"]
        elif pos in ["RW", "LW"]:
            secondary_positions = ["ST", "CAM"]
        elif pos == "ST":
            secondary_positions = ["CAM", "RW"]

        player_doc = {
            "id": player_id,
            "user_id": None,
            "name": f"TEST Jugador {i+1:02d}",
            "email": f"test_{match_id}_{i+1:02d}@fake.local",
            "photo_url": None,
            "birth_date": None,
            "player_type": "invitado" if member_role == "invitado" else "frecuente",
            "primary_position": pos,
            "secondary_positions": secondary_positions,
            "unwanted_position": None,
            "matches_played": 0,
            "created_by": organizer_profile["id"],
            "estimated_level": level,
            "created_at": now,
            "is_test_data": True,
        }

        member_doc = {
            "id": str(uuid.uuid4()),
            "group_id": match["group_id"],
            "player_id": player_id,
            "member_role": member_role,
            "status": "activo",
            "invited_by": organizer_profile["id"],
            "created_at": now,
            "is_test_data": True,
        }

        status = "titular" if existing_active_regs + i < match["max_players"] else "suplente"

        reg_doc = {
            "id": reg_id,
            "match_id": match_id,
            "player_id": player_id,
            "status": status,
            "order": existing_active_regs + i + 1,
            "registered_at": now,
            "registration_type": member_role,
            "is_test_data": True,
        }

        await db.player_profiles.insert_one(player_doc)
        await db.group_members.insert_one(member_doc)
        await db.match_registrations.insert_one(reg_doc)

        created_players.append(player_id)
        created_registrations.append(reg_id)

    titular_count = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "titular"}
    )
    suplente_count = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "suplente"}
    )

    return {
        "message": "Jugadores de prueba creados e inscritos correctamente",
        "match_id": match_id,
        "group_id": match["group_id"],
        "created_players": len(created_players),
        "titular_count": titular_count,
        "suplente_count": suplente_count,
    }