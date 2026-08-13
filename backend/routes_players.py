from datetime import datetime, timezone
from pathlib import Path
from auth import get_current_user
from database import db
from models import CreateGuestRequest, ProfileResponse
from rating_calculator import calculate_player_metrics
from services.score_visibility import get_score_visibility_for_player
from pathlib import Path
import uuid
import os
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from storage_cloudinary import upload_image_bytes


UPLOAD_DIR = Path(
    os.environ.get("UPLOAD_DIR", str(Path(__file__).parent / "uploads"))
)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/api/players", tags=["players"])


@router.get("")
async def list_players(user=Depends(get_current_user)):
    if user["role"] == "admin":
        return await db.player_profiles.find({}, {"_id": 0}).to_list(500)

    my_profile = await db.player_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not my_profile:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")

    memberships = await db.group_members.find(
        {"player_id": my_profile["id"], "status": "activo"},
        {"_id": 0},
    ).to_list(500)
    group_ids = [m["group_id"] for m in memberships]
    if not group_ids:
        return []

    member_rows = await db.group_members.find(
        {"group_id": {"$in": group_ids}, "status": "activo"},
        {"_id": 0},
    ).to_list(1000)
    player_ids = sorted({row["player_id"] for row in member_rows})

    return await db.player_profiles.find({"id": {"$in": player_ids}}, {"_id": 0}).to_list(1000)


@router.get("/{player_id}")
async def get_player(player_id: str, user=Depends(get_current_user)):
    profile = await db.player_profiles.find_one({"id": player_id}, {"_id": 0})
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
    visibility = await get_score_visibility_for_player(player_id, user)
    can_view_peer_scores = visibility["can_view_peer_scores"]
    can_view_self_scores = visibility["can_view_self_scores"]

    regs = await db.match_registrations.find({"player_id": player_id, "status": "titular"}, {"_id": 0}).to_list(500)

    history = []
    for reg in regs:
        match = await db.matches.find_one({"id": reg["match_id"]}, {"_id": 0})
        if not match:
            continue

        avg_rating = None
        if can_view_peer_scores:
            ratings = await db.peer_ratings.find(
                {"match_id": reg["match_id"], "rated_player_id": player_id},
                {"_id": 0},
            ).to_list(100)
            avg_rating = sum(r["score"] for r in ratings) / len(ratings) if ratings else None

        gen = await db.team_generations.find({"match_id": reg["match_id"]}, {"_id": 0}).to_list(1)
        assignment = None
        if gen:
            for a in gen[0].get("assignments", []):
                if a["player_id"] == player_id:
                    assignment = a
                    break

        stats = await db.stats_final.find_one({"match_id": reg["match_id"], "player_id": player_id}, {"_id": 0})

        self_eval = None
        if can_view_self_scores:
            self_eval = await db.self_evaluations.find_one(
                {"match_id": reg["match_id"], "player_id": player_id},
                {"_id": 0},
            )

        history.append({
            "match_id": match["id"],
            "match_title": match["title"],
            "match_date": match["date"],
            "modality": match["modality"],
            "avg_rating": round(avg_rating, 2) if avg_rating is not None else None,
            "position_played": assignment.get("position") if assignment else None,
            "team": assignment.get("team") if assignment else None,
            "stats": stats,
            "self_evaluation": self_eval,
        })

    history.sort(key=lambda x: x["match_date"], reverse=True)
    return {
        "history": history,
        "can_view_peer_scores": can_view_peer_scores,
        "can_view_self_scores": can_view_self_scores,
        "score_visibility_scope": visibility["scope"],
    }


@router.get("/{player_id}/metrics")
async def get_player_metrics(player_id: str, user=Depends(get_current_user)):
    metrics = await calculate_player_metrics(player_id)
    visibility = await get_score_visibility_for_player(player_id, user)
    can_view_peer_scores = visibility["can_view_peer_scores"]

    if not can_view_peer_scores:
        metrics["general_rating"] = None
        metrics["recent_rating"] = None
        metrics["confidence_index"] = None
        metrics["stats_bonus"] = None
        metrics["final_score"] = None
        metrics["position_ratings"] = {}

    metrics["can_view_peer_scores"] = can_view_peer_scores
    metrics["can_view_self_scores"] = visibility["can_view_self_scores"]
    metrics["score_visibility_scope"] = visibility["scope"]
    return metrics


@router.post("/guest")
async def create_guest(data: CreateGuestRequest, user=Depends(get_current_user)):
    profile = await db.player_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=400, detail="Perfil no encontrado")

    guest_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    guest_doc = {
        "id": guest_id,
        "user_id": None,
        "name": data.name,
        "email": str(data.email).lower() if data.email else None,
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

@router.post("/{player_id}/photo")
async def upload_guest_photo(player_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    profile = await db.player_profiles.find_one({"id": player_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    my_profile = await db.player_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if user["role"] != "admin" and (not my_profile or profile.get("created_by") != my_profile["id"]):
        raise HTTPException(status_code=403, detail="Solo el creador o admin puede subir foto")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten imagenes")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen no puede superar 5MB")

    uploaded = upload_image_bytes(
        content=content,
        filename=file.filename or "guest.jpg",
        folder="futbol-pro/guests",
    )

    await db.player_profiles.update_one(
        {"id": player_id},
        {
            "$set": {
                "photo_url": uploaded["photo_url"],
                "photo_public_id": uploaded["photo_public_id"],
            }
        },
    )
    return {"photo_url": uploaded["photo_url"]}