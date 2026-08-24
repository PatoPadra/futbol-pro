from database import db
from constants import FORMATIONS, FORMATION_COORDS, MODALITY_CAPACITY, POSITION_MAP
from rating_calculator import get_player_scores_for_balance
import logging

logger = logging.getLogger(__name__)


# Quien no declaró género y quien eligió "prefiero no decir" caen en la MISMA
# bolsa a los efectos del reparto. No es una fusión conceptual de los dos casos:
# es que en los dos el balanceador no tiene un dato con el que separar, y meterlos
# en bolsas distintas sólo agregaría dos grupos chicos que se reparten peor.
GENDER_UNKNOWN = "sin_declarar"

# Orden de procesamiento de las bolsas. El orden importa: la primera bolsa se
# reparte sobre equipos vacíos y es la que más margen tiene para emparejar los
# puntajes, así que arranca la más grande (ver _bolsas_por_genero).
GENDER_BALANCE_BUCKETS = ["masculino", "femenino", "otro", GENDER_UNKNOWN]


def _bolsa_de_genero(player: dict) -> str:
    """Bolsa de reparto de un jugador. Ver GENDER_UNKNOWN."""
    genero = player.get("gender")
    if genero in ("masculino", "femenino", "otro"):
        return genero
    return GENDER_UNKNOWN


def _bolsas_por_genero(players: list) -> list:
    """
    Agrupa por género y devuelve las bolsas ordenadas de mayor a menor, cada una
    con sus jugadores de mejor a peor puntaje.

    Repartir bolsa por bolsa (y no la lista entera de una) es lo que garantiza
    que cada género quede dividido en partes iguales: dentro de una bolsa los
    jugadores se van alternando entre los dos equipos, así que al terminarla la
    diferencia de esa bolsa entre A y B es 0 o 1. Si la lista se recorriera
    entera ordenada por puntaje, un partido mixto podía terminar con todas las
    mujeres del mismo lado sin que el balance de puntaje se quejara.
    """
    por_bolsa = {}
    for p in players:
        por_bolsa.setdefault(_bolsa_de_genero(p), []).append(p)

    bolsas = [
        sorted(por_bolsa[nombre], key=lambda p: p["score"], reverse=True)
        for nombre in GENDER_BALANCE_BUCKETS
        if por_bolsa.get(nombre)
    ]
    # -len primero, y el índice de GENDER_BALANCE_BUCKETS como desempate para que
    # dos bolsas del mismo tamaño salgan siempre en el mismo orden (determinismo:
    # regenerar los equipos sin que cambie nada no debería dar otro resultado).
    bolsas.sort(key=lambda b: (-len(b), GENDER_BALANCE_BUCKETS.index(_bolsa_de_genero(b[0]))))
    return bolsas


# Peso del desbalance de género dentro del costo de orientar un par en el
# 11v11. Ver el comentario largo en _try_formation.
GENDER_PENALTY = 2.0


def _desbalance_genero_tras(gender_count: dict, en_a: dict, en_b: dict) -> int:
    """
    Desbalance total de géneros si `en_a` fuera al equipo A y `en_b` al B.

    Es la suma, sobre cada bolsa, de |cuántos hay en A - cuántos hay en B|.
    Cero significa que cada género quedó partido exactamente al medio.
    """
    proyectado = {bolsa: dict(c) for bolsa, c in gender_count.items()}
    proyectado.setdefault(_bolsa_de_genero(en_a), {"A": 0, "B": 0})
    proyectado[_bolsa_de_genero(en_a)]["A"] += 1
    proyectado.setdefault(_bolsa_de_genero(en_b), {"A": 0, "B": 0})
    proyectado[_bolsa_de_genero(en_b)]["B"] += 1
    return sum(abs(c["A"] - c["B"]) for c in proyectado.values())


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
            "gender": profile.get("gender"),
            "score": score,
            "player_score": round(float(score), 2),
        })

    if modality == 11 and len(players) >= 22:
        return await _balance_11v11(players[:22], match_id)
    else:
        return _balance_small_format(players, match_id, modality)


def _balance_small_format(players: list, match_id: str, modality: int) -> dict:
    """
    Reparte de 5v5 a 10v10 alternando por puntaje, bolsa de género por bolsa.

    Antes era un snake draft sobre la lista entera ordenada por puntaje. Eso
    equilibra los puntajes pero es ciego al género: en un mixto con 4 mujeres,
    si las cuatro caían en posiciones del ciclo que van al mismo equipo, iban
    todas al mismo equipo y el balance de puntaje quedaba igual de contento.

    Ahora se recorre bolsa por bolsa (masculino, femenino, otro, sin declarar) y
    dentro de cada una se toman los jugadores DE A PARES: el de más puntaje del
    par va al equipo que viene más flojo. Como cada par aporta uno a cada lado,
    al terminar la bolsa cada género quedó partido al medio. Y como el par se
    orienta mirando la suma acumulada, el puntaje se sigue emparejando —
    quedan las dos cosas, no una a costa de la otra.

    El jugador impar de una bolsa va al equipo con menos gente (desempata la
    suma más baja), y no siempre al mismo: así varias bolsas impares no se
    apilan todas del mismo lado.
    """
    team_a = []
    team_b = []
    sum_a = 0.0
    sum_b = 0.0

    for bolsa in _bolsas_por_genero(players):
        for i in range(0, len(bolsa), 2):
            par = bolsa[i:i + 2]

            if len(par) == 1:
                solo = par[0]
                if (len(team_a), sum_a) <= (len(team_b), sum_b):
                    team_a.append(solo)
                    sum_a += solo["score"]
                else:
                    team_b.append(solo)
                    sum_b += solo["score"]
                continue

            mejor, peor = par
            if sum_a <= sum_b:
                team_a.append(mejor)
                team_b.append(peor)
                sum_a += mejor["score"]
                sum_b += peor["score"]
            else:
                team_b.append(mejor)
                team_a.append(peor)
                sum_b += mejor["score"]
                sum_a += peor["score"]

    assignments = [
        _assignment(p, equipo, p.get("primary_position") or "JUG")
        for equipo, plantel in (("A", team_a), ("B", team_b))
        for p in plantel
    ]

    total = sum_a + sum_b
    balance_score = 1.0 - abs(sum_a - sum_b) / total if total > 0 else 1.0

    return {
        "match_id": match_id,
        "formation_a": None,
        "formation_b": None,
        "assignments": assignments,
        "balance_score": round(balance_score, 4),
        "gender_split": _gender_split(team_a, team_b),
    }


def _assignment(player: dict, team: str, position: str) -> dict:
    """La fila de un jugador en la generación. Un solo lugar donde se arma."""
    return {
        "player_id": player["id"],
        "player_name": player["name"],
        "player_photo": player.get("photo_url"),
        "player_gender": player.get("gender"),
        "team": team,
        "position": position,
        "is_manual": False,
        "player_score": player.get("player_score"),
    }


def _gender_split(team_a: list, team_b: list) -> dict:
    """
    Cuántos de cada bolsa quedaron en cada equipo. Se guarda con la generación
    para que la pantalla de equipos pueda mostrar el reparto y para poder
    auditar el balanceo sin volver a correrlo.
    """
    conteo = {}
    for equipo, plantel in (("A", team_a), ("B", team_b)):
        for p in plantel:
            bolsa = _bolsa_de_genero(p)
            conteo.setdefault(bolsa, {"A": 0, "B": 0})[equipo] += 1
    return conteo


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
        "gender_split": best_result["gender_split"],
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
    gender_count = {}

    # Definida una sola vez y no adentro del for: lee sum_a, sum_b y gender_count
    # por closure EN EL MOMENTO DE LLAMARLA, así que ve siempre los valores
    # actuales de la iteración en curso. Rearmarla en cada par no cambiaba nada y
    # eran ~77 funciones descartadas por cada generación de un 11v11.
    def costo(a_player, b_player):
        desbalance_puntaje = abs(
            (sum_a + a_player["score"]) - (sum_b + b_player["score"])
        )
        desbalance_genero = _desbalance_genero_tras(gender_count, a_player, b_player)
        return desbalance_puntaje + GENDER_PENALTY * desbalance_genero

    for pos, p1, p2 in position_pairs:
        if p2 is None:
            # Only one player for this position, assign to smaller team
            if sum_a <= sum_b:
                team_a_players.append((pos, p1))
                sum_a += p1["score"]
                gender_count.setdefault(_bolsa_de_genero(p1), {"A": 0, "B": 0})["A"] += 1
            else:
                team_b_players.append((pos, p1))
                sum_b += p1["score"]
                gender_count.setdefault(_bolsa_de_genero(p1), {"A": 0, "B": 0})["B"] += 1
            continue
        
        # Los dos jugadores de este puesto van uno a cada equipo; lo único que
        # se decide acá es de qué lado va cada uno. Antes se miraba sólo la suma
        # de puntaje (el mejor al equipo más flojo). Ahora se evalúan las dos
        # orientaciones y gana la de menor costo, donde el costo suma la
        # diferencia de puntaje MÁS una penalización por desbalance de género.
        #
        # No es un desempate: es un término del costo, con peso GENDER_PENALTY.
        # Con puntajes de 0 a 10, 2.0 pesa como un quinto de jugador — alcanza
        # para inclinar la orientación cuando el puntaje da parecido, y no para
        # armar un equipo notoriamente más fuerte con tal de repartir géneros.
        higher = p1 if p1["score"] >= p2["score"] else p2
        lower = p2 if p1["score"] >= p2["score"] else p1

        if costo(higher, lower) <= costo(lower, higher):
            en_a, en_b = higher, lower
        else:
            en_a, en_b = lower, higher

        team_a_players.append((pos, en_a))
        team_b_players.append((pos, en_b))
        sum_a += en_a["score"]
        sum_b += en_b["score"]
        gender_count.setdefault(_bolsa_de_genero(en_a), {"A": 0, "B": 0})["A"] += 1
        gender_count.setdefault(_bolsa_de_genero(en_b), {"A": 0, "B": 0})["B"] += 1

    assignments = [
        _assignment(p, equipo, pos)
        for equipo, plantel in (("A", team_a_players), ("B", team_b_players))
        for pos, p in plantel
    ]

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
        "gender_split": _gender_split(
            [p for _, p in team_a_players], [p for _, p in team_b_players]
        ),
    }
