from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import db
from models import (
    PeerRatingBatchRequest,
    SelfEvaluationRequest,
    StatsProposalRequest,
    StatsVoteRequest,
)
from services.matches import ensure_match_participant, get_match_or_404
from services.permissions import ensure_group_member, ensure_group_organizer
from services.profiles import get_my_profile_or_404

router = APIRouter(prefix="/api/matches", tags=["post-match"])


@router.post("/{match_id}/finalize")
async def finalize_match(match_id: str, user=Depends(get_current_user)):
    """Mark match as finished, open evaluations."""
    match = await get_match_or_404(match_id)
    await ensure_group_organizer(match["group_id"], user)

    await db.matches.update_one(
        {"id": match_id}, {"$set": {"status": "finalizado"}}
    )

    regs = await db.match_registrations.find(
        {"match_id": match_id, "status": "titular"}, {"_id": 0}
    ).to_list(100)

    for reg in regs:
        await db.player_profiles.update_one(
            {"id": reg["player_id"]},
            {"$inc": {"matches_played": 1}},
        )

    return {"message": "Partido finalizado. Evaluaciones abiertas."}


@router.post("/{match_id}/ratings")
async def submit_ratings(match_id: str, data: PeerRatingBatchRequest, user=Depends(get_current_user)):
    match, profile, _ = await ensure_match_participant(match_id, user)

    if match.get("status") not in ["finalizado", "completado"]:
        raise HTTPException(status_code=400, detail="Las evaluaciones solo se habilitan cuando el partido esta finalizado")

    registrations = await db.match_registrations.find(
        {"match_id": match_id, "status": {"$ne": "baja"}},
        {"_id": 0},
    ).to_list(500)
    valid_player_ids = {registration["player_id"] for registration in registrations}

    valid_ratings = []
    for rating in data.ratings:
        if rating.score < 1 or rating.score > 10:
            continue
        if rating.rated_player_id == profile["id"]:
            continue
        if rating.rated_player_id not in valid_player_ids:
            raise HTTPException(status_code=400, detail="Solo podes evaluar jugadores que participaron en este partido")

        valid_ratings.append(rating)

    if not valid_ratings:
        raise HTTPException(status_code=400, detail="No hay evaluaciones validas para guardar")

    now = datetime.now(timezone.utc).isoformat()

    await db.peer_ratings.delete_many({"match_id": match_id, "rater_id": profile["id"]})

    for rating in valid_ratings:
        await db.peer_ratings.insert_one(
            {
                "id": str(uuid.uuid4()),
                "match_id": match_id,
                "rater_id": profile["id"],
                "rated_player_id": rating.rated_player_id,
                "score": rating.score,
                "created_at": now,
            }
        )

    return {"message": "Evaluaciones guardadas"}


@router.get("/{match_id}/ratings")
async def get_match_ratings(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_group_member(match["group_id"], user)

    profile = await db.player_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not profile:
        return {"my_ratings": [], "has_rated": False}

    my_ratings = await db.peer_ratings.find(
        {"match_id": match_id, "rater_id": profile["id"]}, {"_id": 0}
    ).to_list(100)

    return {
        "my_ratings": my_ratings,
        "has_rated": len(my_ratings) > 0,
    }


@router.post("/{match_id}/self-evaluation")
async def submit_self_evaluation(match_id: str, data: SelfEvaluationRequest, user=Depends(get_current_user)):
    match, profile, _ = await ensure_match_participant(match_id, user)
    if match.get("status") not in ["finalizado", "completado"]:
        raise HTTPException(status_code=400, detail="La autoevaluación solo se habilita cuando el partido está finalizado")

    now = datetime.now(timezone.utc).isoformat()

    await db.self_evaluations.update_one(
        {"match_id": match_id, "player_id": profile["id"]},
        {"$set": {
            "id": str(uuid.uuid4()),
            "match_id": match_id,
            "player_id": profile["id"],
            "score": data.score,
            "notes": data.notes,
            "created_at": now,
        }},
        upsert=True,
    )

    return {"message": "Autoevaluación guardada"}


@router.get("/{match_id}/self-evaluation")
async def get_self_evaluation(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_group_member(match["group_id"], user)

    profile = await db.player_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not profile:
        return None

    eva = await db.self_evaluations.find_one(
        {"match_id": match_id, "player_id": profile["id"]}, {"_id": 0}
    )
    return eva


@router.post("/{match_id}/stats/propose")
async def propose_stats(match_id: str, data: StatsProposalRequest, user=Depends(get_current_user)):
    match, profile, _ = await ensure_match_participant(match_id, user)
    if match.get("status") not in ["finalizado", "completado"]:
        raise HTTPException(status_code=400, detail="Las estadísticas solo se cargan cuando el partido está finalizado")

    target_registration = await db.match_registrations.find_one(
        {"match_id": match_id, "player_id": data.player_id, "status": {"$ne": "baja"}},
        {"_id": 0},
    )
    if not target_registration:
        raise HTTPException(status_code=400, detail="Solo puedes proponer estadísticas para jugadores que participaron")

    now = datetime.now(timezone.utc).isoformat()

    existing = await db.stats_proposals.find_one(
        {"match_id": match_id, "player_id": data.player_id, "proposed_by": profile["id"]},
        {"_id": 0},
    )
    if existing:
        await db.stats_proposals.update_one(
            {"id": existing["id"]},
            {"$set": {"goals": data.goals, "assists": data.assists, "saves": data.saves}},
        )
        return {"message": "Propuesta actualizada"}

    proposal = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "player_id": data.player_id,
        "goals": data.goals,
        "assists": data.assists,
        "saves": data.saves,
        "proposed_by": profile["id"],
        "votes": [profile["id"]],
        "created_at": now,
    }
    await db.stats_proposals.insert_one(proposal)
    return {"message": "Propuesta de estadísticas creada", "id": proposal["id"]}


@router.get("/{match_id}/stats/proposals")
async def get_stats_proposals(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_group_member(match["group_id"], user)

    proposals = await db.stats_proposals.find({"match_id": match_id}, {"_id": 0}).to_list(500)
    if not proposals:
        return []

    player_ids = list({proposal["player_id"] for proposal in proposals})
    players = await db.player_profiles.find({"id": {"$in": player_ids}}, {"_id": 0}).to_list(500)
    player_map = {player["id"]: player for player in players}

    for proposal in proposals:
        player = player_map.get(proposal["player_id"])
        proposal["player_name"] = player["name"] if player else "Desconocido"

    return proposals


@router.post("/{match_id}/stats/vote")
async def vote_on_stats(match_id: str, data: StatsVoteRequest, user=Depends(get_current_user)):
    match, profile, _ = await ensure_match_participant(match_id, user)
    if match.get("status") not in ["finalizado", "completado"]:
        raise HTTPException(status_code=400, detail="Las estadísticas solo se votan cuando el partido está finalizado")

    proposal = await db.stats_proposals.find_one({"id": data.proposal_id}, {"_id": 0})
    if not proposal or proposal.get("match_id") != match_id:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    if profile["id"] in proposal.get("votes", []):
        return {"message": "Ya votaste esta propuesta"}

    await db.stats_proposals.update_one(
        {"id": data.proposal_id},
        {"$push": {"votes": profile["id"]}},
    )

    updated = await db.stats_proposals.find_one({"id": data.proposal_id}, {"_id": 0})
    total_regs = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "titular"}
    )
    required_votes = max(2, total_regs // 2)

    if len(updated.get("votes", [])) >= required_votes:
        now = datetime.now(timezone.utc).isoformat()
        await db.stats_final.update_one(
            {"match_id": match_id, "player_id": updated["player_id"]},
            {"$set": {
                "id": str(uuid.uuid4()),
                "match_id": match_id,
                "player_id": updated["player_id"],
                "goals": updated["goals"],
                "assists": updated["assists"],
                "saves": updated["saves"],
                "confirmed_at": now,
            }},
            upsert=True,
        )
        return {"message": "Estadísticas confirmadas", "confirmed": True}

    return {
        "message": "Voto registrado",
        "confirmed": False,
        "votes": len(updated.get("votes", [])),
        "required": required_votes,
    }


@router.get("/{match_id}/stats/final")
async def get_final_stats(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_group_member(match["group_id"], user)

    stats = await db.stats_final.find({"match_id": match_id}, {"_id": 0}).to_list(100)
    if not stats:
        return []

    player_ids = list({row["player_id"] for row in stats})
    players = await db.player_profiles.find({"id": {"$in": player_ids}}, {"_id": 0}).to_list(200)
    player_map = {player["id"]: player for player in players}

    for row in stats:
        player = player_map.get(row["player_id"])
        row["player_name"] = player["name"] if player else "Desconocido"

    return stats


@router.post("/{match_id}/complete")
async def complete_match(match_id: str, user=Depends(get_current_user)):
    """Mark match as fully completed."""
    match = await get_match_or_404(match_id)
    await ensure_group_organizer(match["group_id"], user)

    await db.matches.update_one(
        {"id": match_id}, {"$set": {"status": "completado"}}
    )
    return {"message": "Partido completado"}
