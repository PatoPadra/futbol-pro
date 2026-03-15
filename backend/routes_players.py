from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import get_current_user
from models import CreateGuestRequest, ProfileResponse
from rating_calculator import calculate_player_metrics
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/players", tags=["players"])


@router.get("")
async def list_players(user=Depends(get_current_user)):
    profiles = await db.player_profiles.find({}, {"_id": 0}).to_list(500)
    return profiles


@router.get("/{player_id}")
async def get_player(player_id: str, user=Depends(get_current_user)):
    profile = await db.player_profiles.find_one(
        {"id": player_id}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    
    if profile.get("birth_date"):
        try:
            bd = datetime.strptime(profile["birth_date"], "%Y-%m-%d")
            today = datetime.now(timezone.utc)
            profile["age"] = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
        except ValueError:
            pass
    
    return profile


@router.get("/{player_id}/history")
async def get_player_history(player_id: str, user=Depends(get_current_user)):
    # Get all matches this player participated in
    regs = await db.match_registrations.find(
        {"player_id": player_id, "status": "titular"}, {"_id": 0}
    ).to_list(500)

    history = []
    for reg in regs:
        match = await db.matches.find_one({"id": reg["match_id"]}, {"_id": 0})
        if not match:
            continue

        # Get peer ratings received in this match
        ratings = await db.peer_ratings.find(
            {"match_id": reg["match_id"], "rated_player_id": player_id}, {"_id": 0}
        ).to_list(100)
        avg_rating = sum(r["score"] for r in ratings) / len(ratings) if ratings else None

        # Get team assignment
        gen = await db.team_generations.find_one(
            {"match_id": reg["match_id"]}, {"_id": 0}
        )
        assignment = None
        if gen:
            for a in gen.get("assignments", []):
                if a["player_id"] == player_id:
                    assignment = a
                    break

        # Get confirmed stats
        stats = await db.stats_final.find_one(
            {"match_id": reg["match_id"], "player_id": player_id}, {"_id": 0}
        )

        # Get self evaluation (only if requesting own history)
        self_eval = None
        my_profile = await db.player_profiles.find_one(
            {"user_id": user["user_id"]}, {"_id": 0}
        )
        if my_profile and my_profile["id"] == player_id:
            self_eval = await db.self_evaluations.find_one(
                {"match_id": reg["match_id"], "player_id": player_id}, {"_id": 0}
            )

        history.append({
            "match_id": match["id"],
            "match_title": match["title"],
            "match_date": match["date"],
            "modality": match["modality"],
            "avg_rating": round(avg_rating, 2) if avg_rating else None,
            "position_played": assignment.get("position") if assignment else None,
            "team": assignment.get("team") if assignment else None,
            "stats": stats,
            "self_evaluation": self_eval,
        })

    history.sort(key=lambda x: x["match_date"], reverse=True)
    return history


@router.get("/{player_id}/metrics")
async def get_player_metrics(player_id: str, user=Depends(get_current_user)):
    metrics = await calculate_player_metrics(player_id)
    return metrics


@router.post("/guest")
async def create_guest(data: CreateGuestRequest, user=Depends(get_current_user)):
    profile = await db.player_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")

    guest_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    guest_doc = {
        "id": guest_id,
        "user_id": None,
        "name": data.name,
        "email": None,
        "photo_url": None,
        "birth_date": None,
        "player_type": "invitado",
        "primary_position": data.primary_position,
        "secondary_positions": [],
        "unwanted_position": None,
        "matches_played": 0,
        "created_by": profile["id"],
        "estimated_level": data.estimated_level,
        "created_at": now,
    }
    await db.player_profiles.insert_one(guest_doc)

    return ProfileResponse(**guest_doc)
