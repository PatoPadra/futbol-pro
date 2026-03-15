from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import get_current_user
from models import TeamGenerationResponse, ManualAdjustRequest
from team_balancer import generate_teams
from constants import FORMATION_COORDS, FORMATIONS
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/matches", tags=["teams"])


@router.post("/{match_id}/generate-teams", response_model=TeamGenerationResponse)
async def generate_match_teams(match_id: str, user=Depends(get_current_user)):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    profile = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if user["role"] != "admin" and (not profile or profile["id"] != match["organizer_id"]):
        raise HTTPException(status_code=403, detail="Solo el organizador puede generar equipos")

    try:
        result = await generate_teams(match_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    gen_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    gen_doc = {
        "id": gen_id,
        "match_id": match_id,
        "formation_a": result.get("formation_a"),
        "formation_b": result.get("formation_b"),
        "status": "borrador",
        "assignments": result["assignments"],
        "balance_score": result["balance_score"],
        "created_at": now,
    }

    # Remove previous generations for this match
    await db.team_generations.delete_many({"match_id": match_id})
    await db.team_generations.insert_one(gen_doc)

    await db.matches.update_one(
        {"id": match_id}, {"$set": {"status": "equipos_generados"}}
    )

    return TeamGenerationResponse(**{k: v for k, v in gen_doc.items() if k != "_id"})


@router.get("/{match_id}/teams")
async def get_match_teams(match_id: str, user=Depends(get_current_user)):
    gen = await db.team_generations.find_one(
        {"match_id": match_id}, {"_id": 0}
    )
    if not gen:
        raise HTTPException(status_code=404, detail="No se han generado equipos aún")

    # Include formation coordinates for pitch visualization
    coords_a = FORMATION_COORDS.get(gen.get("formation_a"), [])
    coords_b = FORMATION_COORDS.get(gen.get("formation_b"), [])
    available_formations = list(FORMATIONS.keys())

    return {
        **gen,
        "coords_a": coords_a,
        "coords_b": coords_b,
        "available_formations": available_formations,
    }


@router.put("/{match_id}/teams")
async def adjust_teams(
    match_id: str,
    data: ManualAdjustRequest,
    user=Depends(get_current_user),
):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    gen = await db.team_generations.find_one(
        {"match_id": match_id}, {"_id": 0}
    )
    if not gen:
        raise HTTPException(status_code=404, detail="No se han generado equipos")

    update = {
        "assignments": [a.model_dump() for a in data.assignments],
    }
    if data.formation_a:
        update["formation_a"] = data.formation_a
    if data.formation_b:
        update["formation_b"] = data.formation_b

    await db.team_generations.update_one(
        {"match_id": match_id}, {"$set": update}
    )

    updated = await db.team_generations.find_one(
        {"match_id": match_id}, {"_id": 0}
    )
    return updated


@router.post("/{match_id}/teams/confirm")
async def confirm_teams(match_id: str, user=Depends(get_current_user)):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    profile = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if user["role"] != "admin" and (not profile or profile["id"] != match["organizer_id"]):
        raise HTTPException(status_code=403, detail="Solo el organizador puede confirmar")

    await db.team_generations.update_one(
        {"match_id": match_id}, {"$set": {"status": "confirmado"}}
    )
    await db.matches.update_one(
        {"id": match_id}, {"$set": {"status": "equipos_confirmados"}}
    )

    return {"message": "Equipos confirmados"}
