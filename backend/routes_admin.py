from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import require_roles
from models import UpdateRoleRequest

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
