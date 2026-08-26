"""
Ganados, empatados y perdidos de un jugador, y su racha reciente.

Vive en su propio módulo y con su propio endpoint, y no adentro de
`calculate_player_metrics`, por una razón concreta: esa función la corre el
balanceador para CADA jugador cada vez que arma equipos, y de ahí sólo necesita
el `final_score`. Sumarle tres consultas más para un dato que el armado no mira
sería pagarlas veintidós veces por partido y a cambio de nada.

El resultado del jugador no se saca de `match_outcomes`. Esa colección existe
para mover el puntaje y por eso deja afuera los modos que no lo usan — Diversión
y Entrenador. Pero saber cuántos ganaste sí tiene sentido en todos los modos, y
al DT es probablemente lo que más le importa. Así que se calcula desde el
marcador y el equipo en que jugó cada uno.
"""

from constants import jugo_el_partido
from database import db

# Cuántos partidos entran en la tira de la racha. Diez es la convención de
# cualquier tabla de fútbol y entra cómodo en una fila del celular.
FORM_LENGTH = 10

GANADO = "ganado"
EMPATADO = "empatado"
PERDIDO = "perdido"

VACIO = {
    "played": 0,
    "won": 0,
    "drawn": 0,
    "lost": 0,
    "win_pct": 0.0,
    "form": [],
}


def resultado_del_jugador(resultado: dict | None, equipo: str | None) -> tuple:
    """Cómo le fue al jugador. Devuelve (desenlace, mis_goles, sus_goles).

    En un partido interno el equipo A es el local; en uno con rival externo, el
    local somos nosotros y el equipo A es el único que hay. En los dos casos
    `home` es el lado del jugador cuando jugó en A, así que la cuenta es la misma
    y no hace falta preguntarle el modo al partido.

    Sin resultado o sin saber en qué equipo estuvo, no hay nada que decir:
    devuelve None y quien llama lo saltea.
    """
    if not resultado or equipo not in ("A", "B"):
        return None, None, None

    local = resultado.get("home_score")
    visitante = resultado.get("away_score")
    if local is None or visitante is None:
        return None, None, None

    mis_goles, sus_goles = (local, visitante) if equipo == "A" else (visitante, local)
    if mis_goles > sus_goles:
        return GANADO, mis_goles, sus_goles
    if mis_goles < sus_goles:
        return PERDIDO, mis_goles, sus_goles
    return EMPATADO, mis_goles, sus_goles


async def _equipo_por_partido(player_id: str) -> dict:
    """En qué equipo jugó el jugador en cada partido del que hay alineación."""
    generaciones = await db.team_generations.find(
        {"assignments.player_id": player_id},
        {"_id": 0, "match_id": 1, "assignments": 1},
    ).to_list(500)

    por_partido = {}
    for generacion in generaciones:
        match_id = generacion.get("match_id")
        if not match_id or match_id in por_partido:
            continue
        for asignacion in generacion.get("assignments", []):
            if asignacion.get("player_id") == player_id:
                por_partido[match_id] = asignacion.get("team")
                break
    return por_partido


async def calcular_historial(player_id: str, limite: int = FORM_LENGTH) -> dict:
    """El historial de resultados de un jugador.

    El cuadro de ganados y perdidos cuenta TODOS los partidos con resultado; la
    tira de la racha muestra los últimos `limite`. Son dos preguntas distintas
    ("cómo le fue en general" y "cómo viene"), y mezclarlas en un solo número
    haría que ninguna de las dos se pueda contestar.

    Los partidos van del más viejo al más nuevo, que es como se lee una racha:
    de izquierda a derecha, igual que el tiempo.
    """
    equipos = await _equipo_por_partido(player_id)
    if not equipos:
        return {**VACIO, "player_id": player_id, "form_length": limite}

    match_ids = sorted(equipos)
    partidos = await db.matches.find(
        {"id": {"$in": match_ids}, "result": {"$ne": None}},
        {
            "_id": 0, "id": 1, "title": 1, "date": 1, "result": 1,
            "match_type": 1, "opponent_name": 1,
        },
    ).to_list(len(match_ids))

    if not partidos:
        return {**VACIO, "player_id": player_id, "form_length": limite}

    # El que no vino no se lleva la victoria, igual que con el puntaje. Sin
    # marca de asistencia vale la regla de siempre (el titular jugó).
    con_resultado = [p["id"] for p in partidos]
    registros = await db.match_registrations.find(
        {"player_id": player_id, "match_id": {"$in": con_resultado}, "status": {"$ne": "baja"}},
        {"_id": 0, "match_id": 1, "status": 1, "attendance": 1},
    ).to_list(len(con_resultado))
    jugo = {reg["match_id"] for reg in registros if jugo_el_partido(reg)}

    filas = []
    for partido in partidos:
        if partido["id"] not in jugo:
            continue
        desenlace, mis_goles, sus_goles = resultado_del_jugador(
            partido.get("result"), equipos.get(partido["id"])
        )
        if not desenlace:
            continue
        filas.append({
            "match_id": partido["id"],
            "match_title": partido.get("title"),
            "match_date": partido.get("date"),
            "match_type": partido.get("match_type"),
            "opponent_name": partido.get("opponent_name"),
            "outcome": desenlace,
            "goals_for": mis_goles,
            "goals_against": sus_goles,
        })

    filas.sort(key=lambda fila: fila.get("match_date") or "")

    ganados = sum(1 for fila in filas if fila["outcome"] == GANADO)
    empatados = sum(1 for fila in filas if fila["outcome"] == EMPATADO)
    perdidos = sum(1 for fila in filas if fila["outcome"] == PERDIDO)
    jugados = len(filas)

    return {
        "player_id": player_id,
        "played": jugados,
        "won": ganados,
        "drawn": empatados,
        "lost": perdidos,
        # Sobre jugados y no sobre ganados+perdidos: el empate es un partido que
        # no se ganó, y esconderlo del denominador infla el número.
        "win_pct": round(ganados / jugados * 100, 1) if jugados else 0.0,
        "form": filas[-limite:],
        "form_length": limite,
    }
