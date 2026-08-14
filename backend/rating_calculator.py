import asyncio
import logging
import math
from datetime import datetime, timedelta, timezone

from database import db

logger = logging.getLogger(__name__)

# Nivel neutro por defecto del proyecto (mismo valor que estimated_level).
# Es el prior hacia el que encogemos cuando no hay evidencia suficiente.
NEUTRAL_PRIOR = 5.0


def compute_final_score(
    recent_rating: float,
    effective_confidence: float,
    stats_bonus: float,
) -> float:
    """Shrinkage bayesiano del rating hacia el prior neutro.

    Con poca evidencia el score tiende a NEUTRAL_PRIOR (5.0), no a cero.
    Asi un jugador nuevo bueno no queda al fondo del ranking del draft.
    """
    return (
        recent_rating * effective_confidence
        + NEUTRAL_PRIOR * (1 - effective_confidence)
        + stats_bonus
    )


async def calculate_player_metrics(player_id: str) -> dict:
    now = datetime.now(timezone.utc)
    sixty_days_ago = (now - timedelta(days=60)).isoformat()

    all_match_ratings = await db.peer_ratings.find(
        {"rated_player_id": player_id},
        {"_id": 0},
    ).to_list(1000)
    recent_match_ratings = [r for r in all_match_ratings if r.get("created_at", "") >= sixty_days_ago]

    all_seed_ratings = await db.group_seed_ratings.find(
        {"rated_player_id": player_id},
        {"_id": 0},
    ).to_list(1000)

    combined_ratings = [
        {**r, "weight": 1.0, "rating_type": "match"}
        for r in all_match_ratings
    ] + [
        {**r, "weight": 0.6, "rating_type": "seed"}
        for r in all_seed_ratings
    ]

    all_stats = await db.stats_final.find({"player_id": player_id}, {"_id": 0}).to_list(1000)
    recent_stats = [s for s in all_stats if s.get("confirmed_at", "") >= sixty_days_ago]

    profile = await db.player_profiles.find_one({"id": player_id}, {"_id": 0})
    if not profile:
        return _default_metrics(player_id)

    general_rating = _weighted_average(combined_ratings) if combined_ratings else profile.get("estimated_level", 5.0) or 5.0
    recent_rating = _recency_weighted_average(recent_match_ratings, now) if recent_match_ratings else general_rating
    position_ratings = await _calculate_position_ratings(player_id, all_match_ratings)

    total_matches = profile.get("matches_played", 0)
    seed_count = len(all_seed_ratings)
    evidence_points = total_matches + min(seed_count, 8)
    confidence_index = min(1.0, evidence_points / 10.0)

    seed_floor = 0.3 + min(seed_count, 5) * 0.05
    effective_confidence = max(confidence_index, seed_floor if seed_count else 0.3)

    stats_bonus = _calculate_stats_bonus(recent_stats)
    final_score = compute_final_score(recent_rating, effective_confidence, stats_bonus)

    total_goals = sum(s.get("goals", 0) for s in all_stats)
    total_assists = sum(s.get("assists", 0) for s in all_stats)
    total_saves = sum(s.get("saves", 0) for s in all_stats)

    return {
        "player_id": player_id,
        "general_rating": round(general_rating, 2),
        "recent_rating": round(recent_rating, 2),
        "confidence_index": round(confidence_index, 2),
        "stats_bonus": round(stats_bonus, 2),
        "final_score": round(final_score, 2),
        "position_ratings": position_ratings,
        "total_matches": total_matches,
        "total_goals": total_goals,
        "total_assists": total_assists,
        "total_saves": total_saves,
    }


def _default_metrics(player_id: str) -> dict:
    return {
        "player_id": player_id,
        "general_rating": 5.0,
        "recent_rating": 5.0,
        "confidence_index": 0.0,
        "stats_bonus": 0.0,
        # Sin evidencia alguna el jugador vale neutro, igual que compute_final_score
        # con confianza 0.0 (5.0), no casi cero.
        "final_score": round(compute_final_score(NEUTRAL_PRIOR, 0.0, 0.0), 2),
        "position_ratings": {},
        "total_matches": 0,
        "total_goals": 0,
        "total_assists": 0,
        "total_saves": 0,
    }


def _weighted_average(ratings: list) -> float:
    if not ratings:
        return 5.0

    weighted_sum = 0.0
    weight_total = 0.0
    for rating in ratings:
        score = rating.get("score")
        weight = float(rating.get("weight", 1.0) or 1.0)
        if score is None:
            continue
        weighted_sum += score * weight
        weight_total += weight

    return weighted_sum / weight_total if weight_total > 0 else 5.0


def _recency_weighted_average(ratings: list, now: datetime) -> float:
    if not ratings:
        return 5.0

    weighted_sum = 0.0
    weight_total = 0.0
    for rating in ratings:
        try:
            created = datetime.fromisoformat(rating["created_at"].replace("Z", "+00:00"))
            days_ago = max((now - created).days, 1)
        except (ValueError, KeyError, TypeError, AttributeError):
            # created_at faltante, nulo o con formato raro: lo tratamos como
            # una calificacion de hace 30 dias en vez de romper el calculo.
            days_ago = 30

        weight = 1.0 / math.log2(days_ago + 1)
        weighted_sum += rating["score"] * weight
        weight_total += weight

    return weighted_sum / weight_total if weight_total > 0 else 5.0


async def _calculate_position_ratings(player_id: str, all_ratings: list) -> dict:
    generations = await db.team_generations.find(
        {"assignments.player_id": player_id},
        {"_id": 0},
    ).to_list(500)

    position_match_map = {}
    for gen in generations:
        for assignment in gen.get("assignments", []):
            if assignment["player_id"] == player_id:
                position_match_map[gen["match_id"]] = assignment["position"]

    position_scores = {}
    for rating in all_ratings:
        match_id = rating.get("match_id", "")
        position = position_match_map.get(match_id)
        if position:
            position_scores.setdefault(position, []).append(rating["score"])

    return {
        position: round(sum(scores) / len(scores), 2)
        for position, scores in position_scores.items()
        if scores
    }


def _calculate_stats_bonus(recent_stats: list) -> float:
    if not recent_stats:
        return 0.0

    total_goals = sum(stat.get("goals", 0) for stat in recent_stats)
    total_assists = sum(stat.get("assists", 0) for stat in recent_stats)
    total_saves = sum(stat.get("saves", 0) for stat in recent_stats)
    match_count = len(recent_stats)

    goals_per_match = total_goals / match_count if match_count else 0
    assists_per_match = total_assists / match_count if match_count else 0
    saves_per_match = total_saves / match_count if match_count else 0

    raw_bonus = goals_per_match * 0.3 + assists_per_match * 0.2 + saves_per_match * 0.15
    return min(raw_bonus, 1.0)


async def get_player_score_for_balance(player_id: str) -> float:
    metrics = await calculate_player_metrics(player_id)
    return metrics["final_score"]


async def get_player_scores_for_balance(player_ids: list[str]) -> dict[str, float]:
    """Resuelve los final_score de varios jugadores en paralelo.

    Evita el N+1 de llamar a get_player_score_for_balance en un for secuencial:
    para un 11v11 eran ~130 round-trips en serie contra Mongo.
    Devuelve {player_id: final_score}. Si un jugador falla, cae al prior neutro.
    """
    unique_ids = list(dict.fromkeys(player_ids))
    if not unique_ids:
        return {}

    results = await asyncio.gather(
        *(calculate_player_metrics(player_id) for player_id in unique_ids),
        return_exceptions=True,
    )

    scores: dict[str, float] = {}
    for player_id, result in zip(unique_ids, results):
        if isinstance(result, BaseException):
            logger.warning(
                "No se pudo calcular el score del jugador %s: %s", player_id, result
            )
            scores[player_id] = NEUTRAL_PRIOR
        else:
            scores[player_id] = result["final_score"]

    return scores
