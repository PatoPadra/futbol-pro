from database import db
from constants import FORMATIONS, FORMATION_COORDS, MODALITY_CAPACITY, POSITION_MAP
from rating_calculator import get_player_scores_for_balance
import logging

logger = logging.getLogger(__name__)


def _position_fit(player: dict, target_pos: str) -> float:
    """Score how well a player fits a position."""
    primary = player.get("primary_position")
    secondary = player.get("secondary_positions", []) or []
    unwanted = player.get("unwanted_position")
    
    if target_pos == primary:
        return 1.0
    if target_pos in secondary:
        return 0.7
    if target_pos == unwanted:
        return 0.05
    
    # Same zone bonus
    target_zone = POSITION_MAP.get(target_pos, {}).get("zone", "")
    primary_zone = POSITION_MAP.get(primary, {}).get("zone", "") if primary else ""
    if target_zone and target_zone == primary_zone:
        return 0.4
    return 0.2


async def generate_teams(match_id: str) -> dict:
    """Generate balanced teams for a match."""
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise ValueError("Partido no encontrado")

    modality = match["modality"]
    max_per_team = modality

    # Get titular registrations
    registrations = await db.match_registrations.find(
        {"match_id": match_id, "status": "titular"},
        {"_id": 0}
    ).sort("order", 1).to_list(100)

    if len(registrations) < 2:
        raise ValueError("Se necesitan al menos 2 jugadores para generar equipos")

    # Perfiles y scores en batch. Antes esto era un for con dos awaits adentro:
    # un find_one del perfil + get_player_score_for_balance (que a su vez hace 4
    # queries). Para un 11v11 daba ~130 round-trips seriales. Ahora son 1 query
    # de perfiles + las métricas resueltas en paralelo con asyncio.gather.
    player_ids = [reg["player_id"] for reg in registrations]

    profiles = await db.player_profiles.find(
        {"id": {"$in": player_ids}}, {"_id": 0}
    ).to_list(len(player_ids) or 1)
    profile_by_id = {p["id"]: p for p in profiles}

    # Sólo pedimos score de los que tienen perfil: los otros se descartan igual.
    scores_by_id = await get_player_scores_for_balance(
        [pid for pid in player_ids if pid in profile_by_id]
    )

    # Recorremos registrations y no profiles para conservar el orden de anotación
    # (el sort("order", 1) de arriba), que es el que define el snake draft.
    players = []
    for reg in registrations:
        profile = profile_by_id.get(reg["player_id"])
        if not profile:
            continue
        score = scores_by_id[reg["player_id"]]
        players.append({
            "id": profile["id"],
            "name": profile["name"],
            "photo_url": profile.get("photo_url"),
            "primary_position": profile.get("primary_position"),
            "secondary_positions": profile.get("secondary_positions", []),
            "unwanted_position": profile.get("unwanted_position"),
            "score": score,
            "player_score": round(float(score), 2),
        })

    if modality == 11 and len(players) >= 22:
        return await _balance_11v11(players[:22], match_id)
    else:
        return _balance_small_format(players, match_id, modality)


def _balance_small_format(players: list, match_id: str, modality: int) -> dict:
    """Balance teams for 5v5 to 10v10 using snake draft."""
    sorted_players = sorted(players, key=lambda p: p["score"], reverse=True)
    
    half = len(sorted_players) // 2
    team_a = []
    team_b = []

    for i, p in enumerate(sorted_players):
        cycle = i % 4
        if cycle in (0, 3):
            team_a.append(p)
        else:
            team_b.append(p)

    # Ensure equal teams
    while len(team_a) > len(team_b) + 1:
        team_b.append(team_a.pop())
    while len(team_b) > len(team_a) + 1:
        team_a.append(team_b.pop())

    assignments = []
    for p in team_a:
        assignments.append({
            "player_id": p["id"],
            "player_name": p["name"],
            "player_photo": p.get("photo_url"),
            "team": "A",
            "position": p.get("primary_position") or "JUG",
            "is_manual": False,
            "player_score": p.get("player_score"),
        })
    for p in team_b:
        assignments.append({
            "player_id": p["id"],
            "player_name": p["name"],
            "player_photo": p.get("photo_url"),
            "team": "B",
            "position": p.get("primary_position") or "JUG",
            "is_manual": False,
            "player_score": p.get("player_score"),
        })

    sum_a = sum(p["score"] for p in team_a)
    sum_b = sum(p["score"] for p in team_b)
    total = sum_a + sum_b
    balance_score = 1.0 - abs(sum_a - sum_b) / total if total > 0 else 1.0

    return {
        "match_id": match_id,
        "formation_a": None,
        "formation_b": None,
        "assignments": assignments,
        "balance_score": round(balance_score, 4),
    }


async def _balance_11v11(players: list, match_id: str) -> dict:
    """Balance teams for 11v11 using formation-aware assignment."""
    best_result = None
    best_score = -1

    for formation_name, positions in FORMATIONS.items():
        result = _try_formation(players, positions, formation_name, match_id)
        if result and result["combined_score"] > best_score:
            best_score = result["combined_score"]
            best_result = result

    if not best_result:
        # Fallback to small format
        return _balance_small_format(players, match_id, 11)

    return {
        "match_id": match_id,
        "formation_a": best_result["formation"],
        "formation_b": best_result["formation"],
        "assignments": best_result["assignments"],
        "balance_score": round(best_result["balance_score"], 4),
    }


def _try_formation(players: list, formation_positions: list, formation_name: str, match_id: str) -> dict:
    """Try a specific formation and return the best assignment."""
    # We need 22 players for 2 teams of 11
    # Each position in the formation needs 2 players (one per team)
    
    available = list(players)
    position_pairs = []  # List of (position, player_a, player_b)
    
    total_fit_score = 0
    assigned_ids = set()

    for pos in formation_positions:
        # Find best 2 available players for this position
        candidates = []
        for p in available:
            if p["id"] not in assigned_ids:
                fit = _position_fit(p, pos)
                candidates.append((p, fit))
        
        candidates.sort(key=lambda x: (x[1], x[0]["score"]), reverse=True)
        
        if len(candidates) < 2:
            # Not enough players, try with what we have
            if len(candidates) == 1:
                p1 = candidates[0]
                position_pairs.append((pos, p1[0], None))
                total_fit_score += p1[1]
                assigned_ids.add(p1[0]["id"])
            continue
        
        p1, p2 = candidates[0], candidates[1]
        position_pairs.append((pos, p1[0], p2[0]))
        total_fit_score += p1[1] + p2[1]
        assigned_ids.add(p1[0]["id"])
        assigned_ids.add(p2[0]["id"])

    # Now split into teams trying to balance
    team_a_players = []
    team_b_players = []
    sum_a = 0
    sum_b = 0

    for pos, p1, p2 in position_pairs:
        if p2 is None:
            # Only one player for this position, assign to smaller team
            if sum_a <= sum_b:
                team_a_players.append((pos, p1))
                sum_a += p1["score"]
            else:
                team_b_players.append((pos, p1))
                sum_b += p1["score"]
            continue
        
        # Assign higher rated to the team with lower total
        higher = p1 if p1["score"] >= p2["score"] else p2
        lower = p2 if p1["score"] >= p2["score"] else p1
        
        if sum_a <= sum_b:
            team_a_players.append((pos, higher))
            team_b_players.append((pos, lower))
            sum_a += higher["score"]
            sum_b += lower["score"]
        else:
            team_b_players.append((pos, higher))
            team_a_players.append((pos, lower))
            sum_b += higher["score"]
            sum_a += lower["score"]

    # Build assignments
    assignments = []
    for pos, p in team_a_players:
        assignments.append({
            "player_id": p["id"],
            "player_name": p["name"],
            "player_photo": p.get("photo_url"),
            "team": "A",
            "position": pos,
            "is_manual": False,
            "player_score": p.get("player_score"),
        })
    for pos, p in team_b_players:
        assignments.append({
            "player_id": p["id"],
            "player_name": p["name"],
            "player_photo": p.get("photo_url"),
            "team": "B",
            "position": pos,
            "is_manual": False,
            "player_score": p.get("player_score"),
        })

    total = sum_a + sum_b
    balance_score = 1.0 - abs(sum_a - sum_b) / total if total > 0 else 1.0
    avg_fit = total_fit_score / (len(formation_positions) * 2) if formation_positions else 0

    combined_score = balance_score * 0.6 + avg_fit * 0.4

    return {
        "formation": formation_name,
        "assignments": assignments,
        "balance_score": balance_score,
        "fit_score": avg_fit,
        "combined_score": combined_score,
    }
