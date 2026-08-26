"""
Tests del historial de resultados: ganados, empatados, perdidos y la racha.

Lo que se cuida acá es que el dato sea el del JUGADOR y no el del partido. Un
3 a 1 es una victoria o una derrota según de qué lado estuvo parado, y esa es
exactamente la clase de cuenta que se escribe al revés una vez y nadie nota
durante meses porque el número igual "se ve bien".
"""

from datetime import datetime, timezone
import uuid

import pytest

import routes_players as rp
from services.player_record import FORM_LENGTH, calcular_historial, resultado_del_jugador

AHORA = datetime.now(timezone.utc)


async def sembrar_jugador(db, nombre="Jugador"):
    profile_id = str(uuid.uuid4())
    await db.player_profiles.insert_one({
        "id": profile_id,
        "user_id": str(uuid.uuid4()),
        "name": nombre,
        "player_type": "frecuente",
        "matches_played": 0,
        "created_at": AHORA.isoformat(),
    })
    return profile_id


async def sembrar_partido(
    db,
    player_id,
    *,
    equipo="A",
    local=None,
    visitante=None,
    fecha="2026-03-01",
    attendance=None,
    con_alineacion=True,
    mode="avanzado",
):
    """Un partido jugado con su resultado. Devuelve el match_id."""
    match_id = str(uuid.uuid4())
    resultado = None
    if local is not None:
        resultado = {"home_score": local, "away_score": visitante, "notes": None}

    await db.matches.insert_one({
        "id": match_id,
        "group_id": "g",
        "organizer_id": "x",
        "title": f"Partido {fecha}",
        "modality": 5,
        "date": fecha,
        "time": "20:00",
        "location": "La cancha",
        "deadline": "x",
        "status": "finalizado",
        "is_recurring": False,
        "max_players": 10,
        "mode": mode,
        "match_type": "oficial",
        "result": resultado,
        "created_at": AHORA.isoformat(),
    })

    registro = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "player_id": player_id,
        "status": "titular",
        "order": 1,
        "registered_at": AHORA.isoformat(),
    }
    if attendance:
        registro["attendance"] = attendance
    await db.match_registrations.insert_one(registro)

    if con_alineacion:
        await db.team_generations.insert_one({
            "id": str(uuid.uuid4()),
            "match_id": match_id,
            "status": "confirmado",
            "assignments": [{
                "player_id": player_id,
                "player_name": "X",
                "team": equipo,
                "position": "JUG",
                "role": "titular",
                "player_score": 5.0,
            }],
            "balance_score": 1.0,
            "created_at": AHORA.isoformat(),
        })

    return match_id


# ---------------------------------------------------------------------------
# La cuenta, suelta
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "equipo, local, visitante, esperado, a_favor",
    [
        ("A", 3, 1, "ganado", 3),
        ("B", 3, 1, "perdido", 1),
        ("A", 1, 3, "perdido", 1),
        ("B", 1, 3, "ganado", 3),
        ("A", 2, 2, "empatado", 2),
        ("B", 2, 2, "empatado", 2),
    ],
)
def test_un_mismo_marcador_es_victoria_o_derrota_segun_el_lado(equipo, local, visitante, esperado, a_favor):
    resultado = {"home_score": local, "away_score": visitante}
    desenlace, goles_a_favor, _ = resultado_del_jugador(resultado, equipo)
    assert desenlace == esperado
    assert goles_a_favor == a_favor


def test_sin_resultado_o_sin_equipo_no_se_inventa_nada():
    assert resultado_del_jugador(None, "A") == (None, None, None)
    assert resultado_del_jugador({"home_score": 1, "away_score": 0}, None) == (None, None, None)
    # Un partido cuyo resultado quedó a medio cargar tampoco cuenta.
    assert resultado_del_jugador({"home_score": 1}, "A") == (None, None, None)


# ---------------------------------------------------------------------------
# El historial completo
# ---------------------------------------------------------------------------

async def test_cuenta_ganados_empatados_y_perdidos(mongo_en_memoria):
    db = mongo_en_memoria
    jugador = await sembrar_jugador(db)
    await sembrar_partido(db, jugador, equipo="A", local=3, visitante=1, fecha="2026-03-01")
    await sembrar_partido(db, jugador, equipo="A", local=0, visitante=2, fecha="2026-03-08")
    await sembrar_partido(db, jugador, equipo="B", local=1, visitante=1, fecha="2026-03-15")
    await sembrar_partido(db, jugador, equipo="B", local=0, visitante=4, fecha="2026-03-22")

    historial = await calcular_historial(jugador)

    assert historial["played"] == 4
    assert historial["won"] == 2   # el 3-1 desde A y el 0-4 desde B
    assert historial["drawn"] == 1
    assert historial["lost"] == 1
    assert historial["win_pct"] == 50.0


async def test_el_porcentaje_cuenta_los_empates_en_el_denominador(mongo_en_memoria):
    """Sacar los empates de la cuenta infla el número y engaña."""
    db = mongo_en_memoria
    jugador = await sembrar_jugador(db)
    await sembrar_partido(db, jugador, equipo="A", local=1, visitante=0, fecha="2026-03-01")
    await sembrar_partido(db, jugador, equipo="A", local=1, visitante=1, fecha="2026-03-08")
    await sembrar_partido(db, jugador, equipo="A", local=1, visitante=1, fecha="2026-03-15")
    await sembrar_partido(db, jugador, equipo="A", local=1, visitante=1, fecha="2026-03-22")

    historial = await calcular_historial(jugador)

    assert historial["win_pct"] == 25.0


async def test_la_racha_va_del_mas_viejo_al_mas_nuevo(mongo_en_memoria):
    """Se lee de izquierda a derecha, igual que el tiempo."""
    db = mongo_en_memoria
    jugador = await sembrar_jugador(db)
    await sembrar_partido(db, jugador, equipo="A", local=0, visitante=1, fecha="2026-01-10")
    await sembrar_partido(db, jugador, equipo="A", local=2, visitante=2, fecha="2026-02-10")
    await sembrar_partido(db, jugador, equipo="A", local=3, visitante=0, fecha="2026-03-10")

    historial = await calcular_historial(jugador)

    assert [f["outcome"] for f in historial["form"]] == ["perdido", "empatado", "ganado"]
    assert historial["form"][-1]["match_date"] == "2026-03-10"


async def test_la_racha_se_corta_en_diez_pero_el_cuadro_cuenta_todo(mongo_en_memoria):
    """Son dos preguntas distintas: cómo viene y cómo le fue en general."""
    db = mongo_en_memoria
    jugador = await sembrar_jugador(db)
    for i in range(14):
        await sembrar_partido(
            db, jugador, equipo="A", local=1, visitante=0, fecha=f"2026-03-{i + 1:02d}"
        )

    historial = await calcular_historial(jugador)

    assert historial["played"] == 14
    assert historial["won"] == 14
    assert len(historial["form"]) == FORM_LENGTH
    # Los diez últimos, no los diez primeros.
    assert historial["form"][-1]["match_date"] == "2026-03-14"
    assert historial["form"][0]["match_date"] == "2026-03-05"


async def test_un_partido_sin_resultado_no_cuenta(mongo_en_memoria):
    db = mongo_en_memoria
    jugador = await sembrar_jugador(db)
    await sembrar_partido(db, jugador, equipo="A", local=2, visitante=0, fecha="2026-03-01")
    await sembrar_partido(db, jugador, equipo="A", local=None, fecha="2026-03-08")

    historial = await calcular_historial(jugador)

    assert historial["played"] == 1


async def test_el_que_no_vino_no_se_lleva_la_victoria(mongo_en_memoria):
    db = mongo_en_memoria
    jugador = await sembrar_jugador(db)
    await sembrar_partido(db, jugador, equipo="A", local=3, visitante=0, fecha="2026-03-01")
    await sembrar_partido(
        db, jugador, equipo="A", local=5, visitante=0, fecha="2026-03-08", attendance="sin_aviso"
    )

    historial = await calcular_historial(jugador)

    assert historial["played"] == 1
    assert historial["won"] == 1


async def test_sin_alineacion_no_se_puede_saber_de_que_lado_estuvo(mongo_en_memoria):
    """Es el caso de Diversión: hay resultado pero nadie tiene equipo asignado."""
    db = mongo_en_memoria
    jugador = await sembrar_jugador(db)
    await sembrar_partido(
        db, jugador, local=4, visitante=1, fecha="2026-03-01",
        con_alineacion=False, mode="diversion",
    )

    historial = await calcular_historial(jugador)

    assert historial["played"] == 0
    assert historial["form"] == []


async def test_el_modo_entrenador_si_cuenta(mongo_en_memoria):
    """No usa el canal del resultado para el puntaje, pero ganar sigue siendo ganar."""
    db = mongo_en_memoria
    jugador = await sembrar_jugador(db)
    await sembrar_partido(
        db, jugador, equipo="A", local=2, visitante=1, fecha="2026-03-01", mode="entrenador"
    )

    historial = await calcular_historial(jugador)

    assert historial["played"] == 1
    assert historial["won"] == 1


async def test_un_jugador_sin_partidos_devuelve_la_forma_vacia(mongo_en_memoria):
    db = mongo_en_memoria
    jugador = await sembrar_jugador(db)

    historial = await calcular_historial(jugador)

    assert historial["played"] == 0
    assert historial["win_pct"] == 0.0
    assert historial["form"] == []


async def test_el_endpoint_no_esconde_nada_a_los_que_no_organizan(mongo_en_memoria):
    """Quién ganó el sábado lo vieron los veintidós: no es un puntaje interno."""
    db = mongo_en_memoria
    jugador = await sembrar_jugador(db)
    await sembrar_partido(db, jugador, equipo="A", local=3, visitante=1, fecha="2026-03-01")
    curioso = await sembrar_jugador(db, "Curioso")
    perfil = await db.player_profiles.find_one({"id": curioso}, {"_id": 0})

    historial = await rp.get_player_record(
        jugador, user={"user_id": perfil["user_id"], "role": "jugador"}
    )

    assert historial["won"] == 1


# ---------------------------------------------------------------------------
# El historial por partido
# ---------------------------------------------------------------------------

async def test_cada_fila_del_historial_dice_como_salio(mongo_en_memoria):
    db = mongo_en_memoria
    jugador = await sembrar_jugador(db)
    await sembrar_partido(db, jugador, equipo="B", local=1, visitante=4, fecha="2026-03-01")
    perfil = await db.player_profiles.find_one({"id": jugador}, {"_id": 0})

    respuesta = await rp.get_player_history(
        jugador, user={"user_id": perfil["user_id"], "role": "jugador"}
    )

    fila = respuesta["history"][0]
    assert fila["outcome"] == "ganado"
    # Los goles van desde el lado del jugador, no del marcador.
    assert fila["goals_for"] == 4
    assert fila["goals_against"] == 1
