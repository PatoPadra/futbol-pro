from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from constants import coords_de, formaciones_de
from database import db
from models import ManualAdjustRequest, TeamGenerationResponse
from rating_calculator import get_player_score_for_balance
from services.matches import ensure_match_manager, get_match_or_404
from services.permissions import ensure_group_member
from team_balancer import _bolsa_de_genero, generate_teams

router = APIRouter(prefix="/api/matches", tags=["teams"])


def _calculate_age(birth_date_str: str | None):
    if not birth_date_str:
        return None
    try:
        bd = datetime.strptime(birth_date_str, "%Y-%m-%d")
        today = datetime.now(timezone.utc)
        age = today.year - bd.year
        if (today.month, today.day) < (bd.month, bd.day):
            age -= 1
        return age
    except (ValueError, TypeError):
        return None


async def _enrich_assignments(assignments: list[dict]):
    if not assignments:
        return []

    player_ids = [assignment["player_id"] for assignment in assignments]
    profiles = await db.player_profiles.find({"id": {"$in": list(set(player_ids))}}, {"_id": 0}).to_list(500)
    profile_map = {profile["id"]: profile for profile in profiles}

    enriched = []
    for assignment in assignments:
        profile = profile_map.get(assignment["player_id"], {})
        player_score = assignment.get("player_score")
        if player_score is None:
            player_score = await get_player_score_for_balance(assignment["player_id"])

        enriched.append({
            **assignment,
            "player_name": profile.get("name", assignment.get("player_name")),
            "player_photo": profile.get("photo_url", assignment.get("player_photo")),
            "player_primary_position": profile.get("primary_position"),
            "player_gender": profile.get("gender", assignment.get("player_gender")),
            "player_score": round(float(player_score), 2),
            "player_age": _calculate_age(profile.get("birth_date")),
        })

    return enriched


def _build_team_summary(assignments: list[dict], team_label: str):
    team_players = [assignment for assignment in assignments if assignment.get("team") == team_label]
    count = len(team_players)
    total_value = round(sum(float(player.get("player_score") or 0) for player in team_players), 2)
    avg_value = round(total_value / count, 2) if count else 0.0

    ages = [player.get("player_age") for player in team_players if player.get("player_age") is not None]
    avg_age = round(sum(ages) / len(ages), 1) if ages else None

    # El reparto por género se recalcula desde las asignaciones y no se lee del
    # gender_split que guardó el balanceador: después de un ajuste manual el
    # guardado quedaría mintiendo, y esto es justamente lo que el organizador
    # mira para ver si el mixto quedó parejo.
    # Se usa la MISMA función que el balanceador para decidir la bolsa, en vez de
    # un `or "sin_declarar"`. Ese `or` sólo atrapa None y '': "prefiero_no_decir"
    # es un string con contenido, así que se escapaba a una bolsa propia y el
    # resumen mostraba dos filas donde el balanceador había visto una sola. Un
    # mixto repartido correctamente 2 y 2 podía leerse como si estuviera torcido.
    gender_counts = {}
    for player in team_players:
        clave = _bolsa_de_genero({"gender": player.get("player_gender")})
        gender_counts[clave] = gender_counts.get(clave, 0) + 1

    return {
        "team": team_label,
        "count": count,
        "total_value": total_value,
        "average_value": avg_value,
        "average_age": avg_age,
        "gender_counts": gender_counts,
    }


@router.post("/{match_id}/generate-teams", response_model=TeamGenerationResponse)
async def generate_match_teams(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_match_manager(match, user)

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
        # Cómo quedó repartido cada género en el momento de generar. Lo que se
        # muestra en pantalla se recalcula (ver _build_team_summary); esto queda
        # para poder auditar el balanceo sin volver a correrlo.
        "gender_split": result.get("gender_split", {}),
        "created_at": now,
    }

    await db.team_generations.delete_many({"match_id": match_id})
    await db.team_generations.insert_one(gen_doc)

    await db.matches.update_one(
        {"id": match_id}, {"$set": {"status": "equipos_generados"}}
    )

    return TeamGenerationResponse(**{k: v for k, v in gen_doc.items() if k != "_id"})


@router.get("/{match_id}/teams")
async def get_match_teams(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    try:
        await ensure_group_member(match["group_id"], user)
    except HTTPException as exc:
        if exc.status_code != 403:
            raise
        await ensure_match_manager(match, user)

    gen = await db.team_generations.find_one({"match_id": match_id}, {"_id": 0})
    if not gen:
        raise HTTPException(status_code=404, detail="No se han generado equipos aún")

    enriched_assignments = await _enrich_assignments(gen.get("assignments", []))
    # Las formaciones dependen de la modalidad del partido: un F7 no puede
    # ofrecer un 4-4-2. Antes esto devolvía siempre las siete de 11, así que en
    # un partido chico el selector mostraba formaciones imposibles de llenar.
    modality = match["modality"]
    coords_a = coords_de(modality, gen.get("formation_a"))
    coords_b = coords_de(modality, gen.get("formation_b"))
    available_formations = list(formaciones_de(modality).keys())

    return {
        **gen,
        "assignments": enriched_assignments,
        "coords_a": coords_a,
        "coords_b": coords_b,
        "available_formations": available_formations,
        "team_summaries": {
            "A": _build_team_summary(enriched_assignments, "A"),
            "B": _build_team_summary(enriched_assignments, "B"),
        },
    }


@router.put("/{match_id}/teams")
async def adjust_teams(match_id: str, data: ManualAdjustRequest, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_match_manager(match, user)

    gen = await db.team_generations.find_one({"match_id": match_id}, {"_id": 0})
    if not gen:
        raise HTTPException(status_code=404, detail="No se han generado equipos")

    update = {
        "assignments": [assignment.model_dump() for assignment in data.assignments],
    }
    if data.formation_a:
        update["formation_a"] = data.formation_a
    if data.formation_b:
        update["formation_b"] = data.formation_b

    await db.team_generations.update_one({"match_id": match_id}, {"$set": update})

    updated = await db.team_generations.find_one({"match_id": match_id}, {"_id": 0})
    updated["assignments"] = await _enrich_assignments(updated.get("assignments", []))
    updated["team_summaries"] = {
        "A": _build_team_summary(updated["assignments"], "A"),
        "B": _build_team_summary(updated["assignments"], "B"),
    }
    return updated


@router.post("/{match_id}/teams/confirm")
async def confirm_teams(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_match_manager(match, user)

    await db.team_generations.update_one(
        {"match_id": match_id}, {"$set": {"status": "confirmado"}}
    )
    await db.matches.update_one(
        {"id": match_id}, {"$set": {"status": "equipos_confirmados"}}
    )

    return {"message": "Equipos confirmados"}
