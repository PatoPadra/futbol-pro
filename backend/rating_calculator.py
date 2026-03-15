from database import db
from datetime import datetime, timezone, timedelta
import math


async def calculate_player_metrics(player_id: str) -> dict:
    """Calculate all derived metrics for a player."""
    now = datetime.now(timezone.utc)
    sixty_days_ago = (now - timedelta(days=60)).isoformat()

    # Get all peer ratings
    all_ratings = await db.peer_ratings.find(
        {"rated_player_id": player_id}, {"_id": 0}
    ).to_list(1000)

    # Get recent ratings (last 60 days)
    recent_ratings = [r for r in all_ratings if r.get("created_at", "") >= sixty_days_ago]

    # Get confirmed stats
    all_stats = await db.stats_final.find(
        {"player_id": player_id}, {"_id": 0}
    ).to_list(1000)

    recent_stats = [s for s in all_stats if s.get("confirmed_at", "") >= sixty_days_ago]

    # Get player profile
    profile = await db.player_profiles.find_one(
        {"id": player_id}, {"_id": 0}
    )
    if not profile:
        return _default_metrics(player_id)

    # Calculate general rating (all time)
    general_rating = _weighted_average(all_ratings) if all_ratings else profile.get("estimated_level", 5.0) or 5.0

    # Calculate recent rating (last 60 days, weighted by recency)
    recent_rating = _recency_weighted_average(recent_ratings, now) if recent_ratings else general_rating

    # Calculate per-position ratings
    position_ratings = await _calculate_position_ratings(player_id, all_ratings)

    # Confidence index
    total_matches = profile.get("matches_played", 0)
    confidence_index = min(1.0, total_matches / 10.0)

    # Stats bonus (capped)
    stats_bonus = _calculate_stats_bonus(recent_stats)

    # Final score for balance
    final_score = recent_rating * max(confidence_index, 0.3) + stats_bonus

    # Totals
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
        "final_score": 1.5,
        "position_ratings": {},
        "total_matches": 0,
        "total_goals": 0,
        "total_assists": 0,
        "total_saves": 0,
    }


def _weighted_average(ratings: list) -> float:
    if not ratings:
        return 5.0
    scores = [r["score"] for r in ratings]
    return sum(scores) / len(scores)


def _recency_weighted_average(ratings: list, now: datetime) -> float:
    if not ratings:
        return 5.0
    weighted_sum = 0.0
    weight_total = 0.0
    for r in ratings:
        try:
            created = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
            days_ago = max((now - created).days, 1)
        except (ValueError, KeyError):
            days_ago = 30
        weight = 1.0 / math.log2(days_ago + 1)
        weighted_sum += r["score"] * weight
        weight_total += weight
    return weighted_sum / weight_total if weight_total > 0 else 5.0


async def _calculate_position_ratings(player_id: str, all_ratings: list) -> dict:
    """Calculate ratings grouped by position played."""
    # Get all team assignments for this player
    generations = await db.team_generations.find(
        {"assignments.player_id": player_id}, {"_id": 0}
    ).to_list(500)

    position_match_map = {}
    for gen in generations:
        for a in gen.get("assignments", []):
            if a["player_id"] == player_id:
                match_id = gen["match_id"]
                position_match_map[match_id] = a["position"]

    position_scores = {}
    for r in all_ratings:
        match_id = r.get("match_id", "")
        pos = position_match_map.get(match_id)
        if pos:
            if pos not in position_scores:
                position_scores[pos] = []
            position_scores[pos].append(r["score"])

    return {
        pos: round(sum(scores) / len(scores), 2)
        for pos, scores in position_scores.items()
        if scores
    }


def _calculate_stats_bonus(recent_stats: list) -> float:
    """Calculate bonus from confirmed stats. Capped at 1.0."""
    if not recent_stats:
        return 0.0
    total_goals = sum(s.get("goals", 0) for s in recent_stats)
    total_assists = sum(s.get("assists", 0) for s in recent_stats)
    total_saves = sum(s.get("saves", 0) for s in recent_stats)
    n = len(recent_stats)
    goals_per_match = total_goals / n if n else 0
    assists_per_match = total_assists / n if n else 0
    saves_per_match = total_saves / n if n else 0
    raw_bonus = goals_per_match * 0.3 + assists_per_match * 0.2 + saves_per_match * 0.15
    return min(raw_bonus, 1.0)


async def get_player_score_for_balance(player_id: str) -> float:
    """Get the final score used for team balancing."""
    metrics = await calculate_player_metrics(player_id)
    return metrics["final_score"]
