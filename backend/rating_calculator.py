import asyncio
import logging
import math
from datetime import datetime, timedelta, timezone

from constants import (
    DESVIO_MINIMO,
    ESCALA_NORMALIZADA,
    MINIMO_PARA_NORMALIZAR,
    MAX_STATS_BONUS,
    SPLIT_MIN_MATCHES,
    TRACKABLE_STAT_MAP,
    encoger_hacia,
    peso_de_tipo,
    peso_del_resultado,
    valores_de_stats,
)
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


def _promedio_pesado_por_tipo(filas: list) -> tuple:
    """Promedio de puntajes pesando oficial más que práctica.

    Devuelve (promedio, evidencia_efectiva). La evidencia efectiva no es la
    cantidad de filas sino la suma de los pesos: diez prácticas cuentan como
    siete partidos, que es lo mismo que dice el peso de cada una.
    """
    suma = 0.0
    peso_total = 0.0
    for fila in filas:
        peso = peso_de_tipo(fila.get("match_type"))
        suma += float(fila.get("score") or 0.0) * peso
        peso_total += peso
    if peso_total <= 0:
        return 0.0, 0.0
    return suma / peso_total, peso_total


def _mezclar_con_resultado(base: float, outcomes: list) -> float:
    """Mezcla el rating de las evaluaciones con el que sale de los resultados.

    Son dos canales que miden cosas distintas y por eso se mezclan a nivel de
    RATING y no fila por fila. Si se mezclaran fila por fila, las evaluaciones
    ganarían por goleada nada más que por cantidad: un partido deja una fila de
    resultado y hasta veinte de evaluación, y el resultado quedaría en el 5% del
    puntaje sin que nadie lo haya decidido.

    Cuánto pesa el resultado lo decide `peso_del_resultado`, que crece con la
    evidencia y tiene techo. En un grupo que no evalúa a nadie (modo Básico) el
    resultado es lo único que se mueve, y ahí está la gracia: los equipos mejoran
    solos sin pedirle nada a nadie.
    """
    if not outcomes:
        return base
    promedio, evidencia = _promedio_pesado_por_tipo(outcomes)
    if evidencia <= 0:
        return base
    peso = peso_del_resultado(evidencia)
    return base * (1 - peso) + promedio * peso


def _rendimiento_por_partido(match_ratings: list, outcomes: list, tipo_por_partido: dict) -> dict:
    """Un puntaje por partido jugado, con su tipo. {match_id: (score, tipo)}.

    La evaluación de los compañeros manda cuando existe: es lo más cerca que hay
    de una medida individual. Cuando no hay, vale el resultado. Nunca se suman
    los dos para el mismo partido — serían dos votos del mismo hecho.
    """
    por_partido = {}

    acumulado = {}
    for rating in match_ratings:
        suma, cuenta = acumulado.get(rating["match_id"], (0.0, 0))
        acumulado[rating["match_id"]] = (suma + rating["score"], cuenta + 1)
    for match_id, (suma, cuenta) in acumulado.items():
        if cuenta:
            por_partido[match_id] = (suma / cuenta, tipo_por_partido.get(match_id))

    for outcome in outcomes:
        match_id = outcome.get("match_id")
        if match_id and match_id not in por_partido:
            por_partido[match_id] = (
                float(outcome.get("score") or 0.0),
                outcome.get("match_type") or tipo_por_partido.get(match_id),
            )

    return por_partido


def _split_por_tipo(por_partido: dict, referencia: float) -> dict:
    """Cómo le fue al jugador en oficiales contra prácticas.

    Los dos frenos que evitan vender ruido como si fuera un dato (ver
    SPLIT_MIN_MATCHES en constants.py):

      1. `comparable` sólo es verdadero con suficientes partidos de CADA tipo.
         La pantalla no muestra la comparación hasta entonces; muestra cuántos
         faltan.
      2. Cada promedio se encoge hacia el rating general. Con tres partidos
         flojos el número apenas se despega del general; hace falta que la
         diferencia se sostenga para que sobreviva.

    Sin esto, cuatro partidos oficiales malos alcanzarían para decirle a alguien
    que no rinde cuando le toca en serio. Eso, en un grupo de amigos, no es una
    estadística: es una acusación.
    """
    agrupado = {"oficial": [], "practica": []}
    for score, tipo in por_partido.values():
        clave = tipo if tipo in agrupado else "oficial"
        agrupado[clave].append(score)

    tipos = {}
    for clave, scores in agrupado.items():
        cantidad = len(scores)
        crudo = sum(scores) / cantidad if cantidad else referencia
        tipos[clave] = {
            "matches": cantidad,
            "rating": round(encoger_hacia(crudo, cantidad, referencia), 2),
            "missing": max(0, SPLIT_MIN_MATCHES - cantidad),
        }

    comparable = all(datos["matches"] >= SPLIT_MIN_MATCHES for datos in tipos.values())
    return {
        "comparable": comparable,
        "min_matches": SPLIT_MIN_MATCHES,
        "types": tipos,
        # La diferencia sólo se publica cuando se puede comparar. Un número que
        # no hay que mirar todavía es un número que alguien va a mirar igual.
        "gap": round(tipos["oficial"]["rating"] - tipos["practica"]["rating"], 2) if comparable else None,
    }


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

    # El resultado convertido en puntaje (ver services/match_outcomes.py).
    outcomes = await db.match_outcomes.find(
        {"player_id": player_id},
        {"_id": 0},
    ).to_list(1000)
    recent_outcomes = [o for o in outcomes if o.get("created_at", "") >= sixty_days_ago]

    # De qué tipo era cada partido en el que lo evaluaron. Una consulta sola con
    # $in: hace falta para pesar las prácticas menos que los oficiales, y las
    # evaluaciones no guardan el tipo (los outcomes sí, denormalizado).
    match_ids = sorted({r["match_id"] for r in all_match_ratings if r.get("match_id")})
    tipo_por_partido = {}
    if match_ids:
        partidos = await db.matches.find(
            {"id": {"$in": match_ids}}, {"_id": 0, "id": 1, "match_type": 1}
        ).to_list(len(match_ids))
        tipo_por_partido = {m["id"]: m.get("match_type") for m in partidos}

    # Todas las evaluaciones de esos partidos, no sólo las de este jugador: para
    # saber si un 8 es generoso o exigente hace falta ver el resto de las notas
    # que puso ese mismo evaluador esa misma noche.
    #
    # Es una consulta más, con $in sobre match_id, que va por el prefijo del
    # índice (match_id, rater_id) que ya existe.
    todas_del_partido = []
    if match_ids:
        todas_del_partido = await db.peer_ratings.find(
            {"match_id": {"$in": match_ids}},
            {"_id": 0, "match_id": 1, "rater_id": 1, "score": 1},
        ).to_list(len(match_ids) * 40)

    all_match_ratings = _normalizar_por_evaluador(all_match_ratings, todas_del_partido)
    recent_match_ratings = _normalizar_por_evaluador(recent_match_ratings, todas_del_partido)

    combined_ratings = [
        # Una evaluación de una práctica pesa menos que una de un oficial, con el
        # mismo mecanismo con el que una evaluación inicial pesa menos que una de
        # partido. Es un peso más, no un caso especial.
        {**r, "weight": peso_de_tipo(tipo_por_partido.get(r.get("match_id"))), "rating_type": "match"}
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

    evaluado = _weighted_average(combined_ratings) if combined_ratings else profile.get("estimated_level", 5.0) or 5.0
    general_rating = _mezclar_con_resultado(evaluado, outcomes)

    reciente_evaluado = _recency_weighted_average(recent_match_ratings, now) if recent_match_ratings else evaluado
    recent_rating = _mezclar_con_resultado(reciente_evaluado, recent_outcomes)

    position_ratings = await _calculate_position_ratings(player_id, all_match_ratings)

    total_matches = profile.get("matches_played", 0)
    seed_count = len(all_seed_ratings)
    # Los partidos ya cuentan en `matches_played`, así que los outcomes no suman
    # evidencia aparte: sería contar dos veces el mismo partido.
    evidence_points = total_matches + min(seed_count, 8)
    confidence_index = min(1.0, evidence_points / 10.0)

    seed_floor = 0.3 + min(seed_count, 5) * 0.05
    effective_confidence = max(confidence_index, seed_floor if seed_count else 0.3)

    # Los partidos recientes en los que hay CUALQUIER evidencia de que el
    # jugador estuvo: una evaluación, un resultado o una fila de estadísticas.
    # Es el denominador honesto del bonus — ver _calculate_stats_bonus.
    partidos_recientes = len({
        doc["match_id"]
        for doc in (*recent_match_ratings, *recent_outcomes, *recent_stats)
        if doc.get("match_id")
    })

    stats_bonus = _calculate_stats_bonus(recent_stats, partidos_recientes)
    final_score = compute_final_score(recent_rating, effective_confidence, stats_bonus)

    # Acumulado de TODAS las estadísticas que el jugador tenga cargadas. Los
    # tres de siempre salen de acá y siguen viajando con su nombre porque hay
    # pantallas que los leen así.
    totales = _acumular_stats(all_stats)

    por_partido = _rendimiento_por_partido(all_match_ratings, outcomes, tipo_por_partido)
    match_type_split = _split_por_tipo(por_partido, general_rating)

    return {
        "player_id": player_id,
        "general_rating": round(general_rating, 2),
        "recent_rating": round(recent_rating, 2),
        "confidence_index": round(confidence_index, 2),
        "stats_bonus": round(stats_bonus, 2),
        "final_score": round(final_score, 2),
        "position_ratings": position_ratings,
        "match_type_split": match_type_split,
        "result_matches": len(outcomes),
        "total_matches": total_matches,
        "totals": totales,
        "total_goals": totales.get("goals", 0),
        "total_assists": totales.get("assists", 0),
        "total_saves": totales.get("saves", 0),
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
        "match_type_split": _split_por_tipo({}, NEUTRAL_PRIOR),
        "result_matches": 0,
        "total_matches": 0,
        "totals": {},
        "total_goals": 0,
        "total_assists": 0,
        "total_saves": 0,
    }


def _normalizar_por_evaluador(ratings_del_jugador: list, todas_del_partido: list) -> list:
    """Pone a todos los evaluadores en la misma escala antes de promediar.

    Cada evaluador tiene su vara: hay quien reparte nueves y quien no pasa de
    siete. Sin corregir eso, la nota de un jugador depende de a quién le tocó
    evaluarlo — y, peor, inflar a todo el mundo se vuelve una forma barata de
    subirle el puntaje a un amigo.

    La corrección es la de siempre: se centra cada nota en la media de ESE
    evaluador EN ESE PARTIDO y se lleva su dispersión a una escala común. Un
    evaluador que pone 10, 10, 10 tiene desvío cero: sus tres notas colapsan al
    centro, que es lo que corresponde — quien no distingue no aporta
    información, ni a favor ni en contra.

    Sólo se normaliza a partir de MINIMO_PARA_NORMALIZAR notas del mismo
    evaluador en el mismo partido. Con dos no hay dispersión que estimar, y
    inventarla sería peor que usar el número crudo.

    Devuelve una lista nueva; no toca la de entrada.
    """
    if not ratings_del_jugador:
        return []

    por_evaluador: dict[tuple, list] = {}
    for rating in todas_del_partido:
        clave = (rating.get("match_id"), rating.get("rater_id"))
        score = rating.get("score")
        if clave[0] is None or clave[1] is None or score is None:
            continue
        por_evaluador.setdefault(clave, []).append(float(score))

    escalas = {}
    for clave, scores in por_evaluador.items():
        if len(scores) < MINIMO_PARA_NORMALIZAR:
            continue
        media = sum(scores) / len(scores)
        varianza = sum((s - media) ** 2 for s in scores) / len(scores)
        escalas[clave] = (media, math.sqrt(varianza))

    normalizados = []
    for rating in ratings_del_jugador:
        clave = (rating.get("match_id"), rating.get("rater_id"))
        score = rating.get("score")
        escala = escalas.get(clave)
        if score is None or not escala:
            normalizados.append(rating)
            continue

        media, desvio = escala
        ajustado = 5.0 + (float(score) - media) * (ESCALA_NORMALIZADA / max(DESVIO_MINIMO, desvio))
        normalizados.append({**rating, "score": min(10.0, max(1.0, ajustado))})

    return normalizados


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


def _acumular_stats(filas: list) -> dict:
    """Suma las estadísticas de varias filas en un solo {stat_id: total}."""
    totales: dict[str, int] = {}
    for fila in filas:
        for stat_id, valor in valores_de_stats(fila).items():
            totales[stat_id] = totales.get(stat_id, 0) + valor
    return totales


def _calculate_stats_bonus(recent_stats: list, partidos_recientes: int = 0) -> float:
    """Bonus por estadísticas, con los pesos que declara el catálogo.

    Cada estadística trae su peso en TRACKABLE_STATS, y las que no deben mover
    el puntaje pesan cero — que es la mayoría, y por buenas razones (ver el
    comentario largo del catálogo en constants.py).

    EL DENOMINADOR SON LOS PARTIDOS JUGADOS, NO LAS FILAS CARGADAS. Antes se
    dividía por `len(recent_stats)`, o sea por la cantidad de filas de
    estadísticas — y un jugador sin nada que anotar no genera fila. El efecto
    era exactamente el contrario al buscado: el que tenía cargados sólo sus dos
    buenos partidos (3 goles en cada uno) sacaba (6/2)*0.3 = 0.90, y el que
    tenía los diez cargados con 10 goles en total sacaba (10/10)*0.3 = 0.30.
    Tres veces más bonus por menos goles. El goleador del grupo pasaba a ser el
    que tenía mejor prensa.

    El `max` con la cantidad de filas es una red: si por lo que sea llegan más
    filas que partidos, no queremos inflar dividiendo por menos.

    El techo importa más que nunca: sin él, un partido con ocho métricas
    prendidas pesaría distinto que uno con dos por el sólo hecho de contar más
    cosas.
    """
    if not recent_stats:
        return 0.0

    match_count = max(partidos_recientes, len(recent_stats))
    totales = _acumular_stats(recent_stats)

    raw_bonus = sum(
        (total / match_count) * TRACKABLE_STAT_MAP[stat_id]["bonus_weight"]
        for stat_id, total in totales.items()
        if stat_id in TRACKABLE_STAT_MAP
    )
    return min(raw_bonus, MAX_STATS_BONUS)


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
