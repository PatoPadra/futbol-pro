"""
Tests de la fase 2: los modos gatean de verdad, y las estadísticas se eligen.

Lo que se prueba acá es sobre todo que el gateo viva en el ENDPOINT y no sólo en
la pantalla. Esconder un botón no es una regla: mientras la ruta siga aceptando
el pedido, un partido de Diversión puede terminar con equipos que nadie pidió y
con evaluaciones que le mueven el puntaje a los jugadores para siempre.

La otra mitad son las estadísticas configurables: que cada modo siga las que le
corresponden, que no se pueda cargar una que el partido no sigue, y que la
cuenta del bonus dé exactamente lo mismo que antes para los datos ya guardados.
"""

from datetime import datetime, timezone
import uuid

import pytest
from fastapi import HTTPException
import database
import rating_calculator
import routes_groups as rg
import routes_matches as rm
import routes_post_match as rpm
import routes_teams as rt
from constants import CLASSIC_TRACKED_STATS, capacidades_de
from models import (
    CreateGroupRequest,
    CreateMatchRequest,
    PeerRatingBatchRequest,
    SelfEvaluationRequest,
    SetMatchStatsRequest,
    StatsProposalRequest,
    StatsVoteRequest,
    UpdateGroupRequest,
    UpdateMatchRequest,
)


async def sembrar_jugador(db, nombre="Jugador", role="organizador"):
    user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    await db.player_profiles.insert_one({
        "id": profile_id,
        "user_id": user_id,
        "name": nombre,
        "player_type": "frecuente",
        "matches_played": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"user_id": user_id, "role": role}, profile_id


async def sembrar_grupo(db, profile_id, *, default_match_mode=None):
    group_id = str(uuid.uuid4())
    doc = {
        "id": group_id,
        "name": "Los del martes",
        "created_by": profile_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if default_match_mode is not None:
        doc["default_match_mode"] = default_match_mode
    await db.groups.insert_one(doc)
    await db.group_members.insert_one({
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "player_id": profile_id,
        "member_role": "organizador",
        "status": "activo",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return group_id


async def crear_partido(db, user, group_id, **extra):
    data = CreateMatchRequest(
        group_id=group_id,
        title="Partido del sábado",
        modality=5,
        date="2026-09-05",
        time="20:00",
        location="La cancha",
        **extra,
    )
    return await rm.create_match(data, user=user)


async def anotar(db, match_id, player_id, status="titular", order=1):
    await db.match_registrations.insert_one({
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "player_id": player_id,
        "status": status,
        "order": order,
        "registered_at": datetime.now(timezone.utc).isoformat(),
    })


async def armar_partido_jugado(db, mode, *, jugadores=2, **extra):
    """Un partido ya finalizado, con su organizador anotado. Devuelve todo lo necesario."""
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id, mode=mode, **extra)

    ids = [organizador]
    await anotar(db, partido.id, organizador, "titular", 1)
    for i in range(1, jugadores):
        _, otro = await sembrar_jugador(db, f"Jugador {i}")
        await anotar(db, partido.id, otro, "titular", i + 1)
        ids.append(otro)

    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "finalizado"}})
    return user, organizador, partido, ids


# ---------------------------------------------------------------------------
# Armado de equipos
# ---------------------------------------------------------------------------

async def test_diversion_no_arma_equipos(mongo_en_memoria):
    """El botón se esconde en la pantalla, pero la regla vive en el endpoint."""
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id, mode="diversion")
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "cerrado"}})

    with pytest.raises(HTTPException) as exc:
        await rt.generate_match_teams(partido.id, user=user)

    assert exc.value.status_code == 400
    assert "no se arman equipos" in exc.value.detail
    # Y el partido no quedó en un estado del que no se puede salir.
    doc = await db.matches.find_one({"id": partido.id}, {"_id": 0})
    assert doc["status"] == "cerrado"
    assert await db.team_generations.count_documents({"match_id": partido.id}) == 0


@pytest.mark.parametrize("mode", ["basico", "avanzado", "pro"])
async def test_los_modos_con_algoritmo_si_arman_equipos(mongo_en_memoria, mode):
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id, mode=mode)

    for i in range(4):
        _, jugador = await sembrar_jugador(db, f"J{i}")
        await anotar(db, partido.id, jugador, "titular", i + 1)
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "cerrado"}})

    generacion = await rt.generate_match_teams(partido.id, user=user)

    assert len(generacion.assignments) == 4


async def test_entrenador_no_reparte_equipos_sino_que_arma_una_alineacion(mongo_en_memoria):
    """El modo manual no cae en el balanceador: arma un equipo con su banco."""
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id, mode="entrenador")

    for i in range(7):
        _, jugador = await sembrar_jugador(db, f"J{i}")
        await anotar(db, partido.id, jugador, "titular", i + 1)
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "cerrado"}})

    generacion = await rt.generate_match_teams(partido.id, user=user)

    # Todos de nuestro lado: el rival no está en la app.
    assert {a.team for a in generacion.assignments} == {"A"}
    assert generacion.formation_b is None


# ---------------------------------------------------------------------------
# Evaluaciones
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("mode", ["diversion", "basico"])
async def test_los_modos_sin_evaluacion_rechazan_evaluar(mongo_en_memoria, mode):
    db = mongo_en_memoria
    user, organizador, partido, ids = await armar_partido_jugado(db, mode)

    with pytest.raises(HTTPException) as exc:
        await rpm.submit_ratings(
            partido.id,
            PeerRatingBatchRequest(ratings=[{"rated_player_id": ids[1], "score": 8}]),
            user=user,
        )

    assert exc.value.status_code == 400
    assert await db.peer_ratings.count_documents({}) == 0


async def test_los_modos_sin_evaluacion_rechazan_la_autoevaluacion(mongo_en_memoria):
    db = mongo_en_memoria
    user, organizador, partido, _ = await armar_partido_jugado(db, "diversion")

    with pytest.raises(HTTPException) as exc:
        await rpm.submit_self_evaluation(partido.id, SelfEvaluationRequest(score=7), user=user)

    assert exc.value.status_code == 400


async def test_avanzado_si_evalua(mongo_en_memoria):
    db = mongo_en_memoria
    user, organizador, partido, ids = await armar_partido_jugado(db, "avanzado")

    await rpm.submit_ratings(
        partido.id,
        PeerRatingBatchRequest(ratings=[{"rated_player_id": ids[1], "score": 8}]),
        user=user,
    )

    assert await db.peer_ratings.count_documents({"match_id": partido.id}) == 1


# ---------------------------------------------------------------------------
# De dónde salen las estadísticas
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("mode", ["diversion", "basico"])
async def test_los_modos_sin_estadisticas_las_rechazan(mongo_en_memoria, mode):
    db = mongo_en_memoria
    user, organizador, partido, ids = await armar_partido_jugado(db, mode)

    with pytest.raises(HTTPException) as exc:
        await rpm.propose_stats(
            partido.id, StatsProposalRequest(player_id=ids[0], values={"goals": 2}), user=user
        )

    assert exc.value.status_code == 400
    assert "no lleva estadísticas" in exc.value.detail


async def test_en_modo_pro_no_se_proponen_ni_se_votan(mongo_en_memoria):
    """Con planilla del organizador no puede haber además votación: serían dos
    fuentes de verdad para el mismo número."""
    db = mongo_en_memoria
    user, organizador, partido, ids = await armar_partido_jugado(db, "pro")

    with pytest.raises(HTTPException) as exc:
        await rpm.propose_stats(
            partido.id, StatsProposalRequest(player_id=ids[0], values={"goals": 1}), user=user
        )
    assert "las carga el organizador" in exc.value.detail

    with pytest.raises(HTTPException) as exc:
        await rpm.vote_on_stats(partido.id, StatsVoteRequest(proposal_id="x"), user=user)
    assert exc.value.status_code == 400


async def test_en_modo_avanzado_no_se_usa_la_planilla(mongo_en_memoria):
    db = mongo_en_memoria
    user, organizador, partido, ids = await armar_partido_jugado(db, "avanzado")

    with pytest.raises(HTTPException) as exc:
        await rpm.set_match_stats(
            partido.id,
            SetMatchStatsRequest(rows=[{"player_id": ids[0], "values": {"goals": 1}}]),
            user=user,
        )

    assert "se proponen y se votan" in exc.value.detail


async def test_la_planilla_del_organizador_queda_firme_al_guardar(mongo_en_memoria):
    """Sin votación: es la razón de ser del modo con planilla."""
    db = mongo_en_memoria
    user, organizador, partido, ids = await armar_partido_jugado(db, "pro")

    res = await rpm.set_match_stats(
        partido.id,
        SetMatchStatsRequest(rows=[
            {"player_id": ids[0], "values": {"goals": 2, "assists": 1}},
            {"player_id": ids[1], "values": {"goals": 1}},
        ]),
        user=user,
    )

    assert res["rows"] == 2
    filas = await db.stats_final.find({"match_id": partido.id}, {"_id": 0}).to_list(10)
    assert len(filas) == 2
    por_jugador = {f["player_id"]: f for f in filas}
    assert por_jugador[ids[0]]["values"] == {"goals": 2, "assists": 1}
    assert por_jugador[ids[0]]["source"] == "organizador"
    # Las tres columnas viejas se siguen escribiendo, para el que las lea así.
    assert por_jugador[ids[0]]["goals"] == 2


async def test_volver_a_guardar_la_planilla_borra_lo_que_ya_no_esta(mongo_en_memoria):
    """Es la única forma de sacarle un gol a alguien que no lo hizo."""
    db = mongo_en_memoria
    user, organizador, partido, ids = await armar_partido_jugado(db, "pro")

    await rpm.set_match_stats(
        partido.id,
        SetMatchStatsRequest(rows=[
            {"player_id": ids[0], "values": {"goals": 2}},
            {"player_id": ids[1], "values": {"goals": 1}},
        ]),
        user=user,
    )
    await rpm.set_match_stats(
        partido.id,
        SetMatchStatsRequest(rows=[{"player_id": ids[0], "values": {"goals": 2}}]),
        user=user,
    )

    filas = await db.stats_final.find({"match_id": partido.id}, {"_id": 0}).to_list(10)
    assert [f["player_id"] for f in filas] == [ids[0]]


async def test_no_se_carga_una_estadistica_que_el_partido_no_sigue(mongo_en_memoria):
    """Se rechaza en vez de filtrar: un dato tipeado que se descarta en silencio
    es peor que un error."""
    db = mongo_en_memoria
    user, organizador, partido, ids = await armar_partido_jugado(
        db, "pro", tracked_stats=["goals"]
    )

    with pytest.raises(HTTPException) as exc:
        await rpm.set_match_stats(
            partido.id,
            SetMatchStatsRequest(rows=[{"player_id": ids[0], "values": {"tackles": 4}}]),
            user=user,
        )

    assert exc.value.status_code == 400
    assert "Cortes" in exc.value.detail


async def test_no_se_cargan_estadisticas_de_alguien_que_no_jugo(mongo_en_memoria):
    db = mongo_en_memoria
    user, organizador, partido, ids = await armar_partido_jugado(db, "pro")
    _, ajeno = await sembrar_jugador(db, "Ajeno")

    with pytest.raises(HTTPException) as exc:
        await rpm.set_match_stats(
            partido.id,
            SetMatchStatsRequest(rows=[{"player_id": ajeno, "values": {"goals": 1}}]),
            user=user,
        )

    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# Qué estadísticas sigue cada modo
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "mode, esperado",
    [
        ("diversion", []),
        ("basico", []),
        ("avanzado", CLASSIC_TRACKED_STATS),
        # Pro arranca con las tres clásicas: `saves` pasó a default. Antes el
        # modo que "sigue estadísticas" era el único donde el arquero no tenía
        # nada que sumar y su bonus era estructuralmente cero.
        ("pro", ["goals", "assists", "saves"]),
    ],
)
async def test_cada_modo_arranca_con_las_estadisticas_que_le_tocan(mongo_en_memoria, mode, esperado):
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)

    partido = await crear_partido(db, user, group_id, mode=mode)

    assert partido.tracked_stats == list(esperado)


async def test_en_modo_pro_se_eligen_las_estadisticas(mongo_en_memoria):
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)

    partido = await crear_partido(
        db, user, group_id, mode="pro", tracked_stats=["goals", "tackles", "duels_won"]
    )

    assert partido.tracked_stats == ["goals", "tackles", "duels_won"]


async def test_destildar_todo_es_una_eleccion_valida(mongo_en_memoria):
    """Lista vacía no es lo mismo que no haber mandado nada."""
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)

    partido = await crear_partido(db, user, group_id, mode="pro", tracked_stats=[])

    assert partido.tracked_stats == []


async def test_un_modo_que_no_configura_ignora_lo_que_le_manden(mongo_en_memoria):
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)

    partido = await crear_partido(
        db, user, group_id, mode="avanzado", tracked_stats=["tackles"]
    )

    assert partido.tracked_stats == list(CLASSIC_TRACKED_STATS)


async def test_cambiar_el_modo_recalcula_las_estadisticas(mongo_en_memoria):
    """Pasar de Pro a Diversión no puede dejar la lista vieja colgada."""
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id, mode="pro")

    await rm.update_match(partido.id, UpdateMatchRequest(mode="diversion"), user=user)

    doc = await db.matches.find_one({"id": partido.id}, {"_id": 0})
    assert doc["mode"] == "diversion"
    assert doc["tracked_stats"] == []


async def test_las_estadisticas_seguidas_se_congelan_al_cerrar(mongo_en_memoria):
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id, mode="pro")
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "cerrado"}})

    with pytest.raises(HTTPException) as exc:
        await rm.update_match(partido.id, UpdateMatchRequest(tracked_stats=["goals"]), user=user)

    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# El freno de los modos que todavía no tienen pantallas
# ---------------------------------------------------------------------------
#
# Hoy los cinco modos están disponibles, así que el mecanismo se prueba marcando
# uno como no disponible a mano. Sigue haciendo falta: es lo que evita que un
# modo a medio hacer deje partidos en un estado del que no se puede salir, y el
# día que se agregue el sexto va a ser lo primero que se use.

@pytest.fixture
def modo_no_disponible(monkeypatch):
    """Marca 'pro' como que todavía no está, sólo para el test que lo pida."""
    from constants import MATCH_MODE_MAP

    original = dict(MATCH_MODE_MAP["pro"])
    monkeypatch.setitem(MATCH_MODE_MAP, "pro", {**original, "available": False})
    return "pro"


async def test_todos_los_modos_del_catalogo_se_pueden_crear(mongo_en_memoria):
    """Ninguno quedó marcado como no disponible por accidente."""
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)

    for modo in ("diversion", "basico", "avanzado", "pro", "entrenador"):
        partido = await crear_partido(db, user, group_id, mode=modo)
        assert partido.mode == modo


async def test_un_modo_marcado_como_no_disponible_se_rechaza(mongo_en_memoria, modo_no_disponible):
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)

    with pytest.raises(HTTPException) as exc:
        await crear_partido(db, user, group_id, mode=modo_no_disponible)

    assert exc.value.status_code == 400
    assert "todavía no está disponible" in exc.value.detail


async def test_tampoco_como_default_de_un_grupo(mongo_en_memoria, modo_no_disponible):
    db = mongo_en_memoria
    user, _ = await sembrar_jugador(db)

    with pytest.raises(HTTPException) as exc:
        await rg.create_group(
            CreateGroupRequest(name="Mi equipo", default_match_mode=modo_no_disponible), user=user
        )

    assert exc.value.status_code == 400


async def test_ni_cambiando_el_default_despues(mongo_en_memoria, modo_no_disponible):
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)

    with pytest.raises(HTTPException) as exc:
        await rg.update_group(
            group_id, UpdateGroupRequest(default_match_mode=modo_no_disponible), user=user
        )

    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# Estados
# ---------------------------------------------------------------------------

async def test_no_se_finaliza_con_la_inscripcion_abierta(mongo_en_memoria):
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id)

    with pytest.raises(HTTPException) as exc:
        await rpm.finalize_match(partido.id, user=user)

    assert exc.value.status_code == 400
    assert "Cerrá la inscripción" in exc.value.detail


async def test_diversion_llega_a_finalizado_sin_pasar_por_equipos(mongo_en_memoria):
    """El camino corto: anotarse, cerrar, finalizar, cargar el resultado."""
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id, mode="diversion")
    await anotar(db, partido.id, organizador, "titular", 1)

    await rm.close_registrations(partido.id, user=user)
    await rpm.finalize_match(partido.id, user=user)

    doc = await db.matches.find_one({"id": partido.id}, {"_id": 0})
    assert doc["status"] == "finalizado"
    # Y el partido le contó como jugado al que se anotó, sin haber pasado nunca
    # por la pantalla de equipos.
    perfil = await db.player_profiles.find_one({"id": organizador}, {"_id": 0})
    assert perfil["matches_played"] == 1


# ---------------------------------------------------------------------------
# Migración
# ---------------------------------------------------------------------------

async def test_la_migracion_pasa_las_estadisticas_viejas_a_dict(mongo_en_memoria):
    db = mongo_en_memoria
    await db.stats_final.insert_one({
        "id": "s1",
        "match_id": "m1",
        "player_id": "p1",
        "goals": 3,
        "assists": 0,
        "saves": 1,
        "confirmed_at": "2026-01-01T00:00:00+00:00",
    })
    await db.stats_proposals.insert_one({
        "id": "pr1",
        "match_id": "m1",
        "player_id": "p1",
        "goals": 2,
        "assists": 1,
        "saves": 0,
        "proposed_by": "p2",
        "votes": ["p2"],
        "created_at": "2026-01-01T00:00:00+00:00",
    })

    await database.backfill_match_defaults()

    final = await db.stats_final.find_one({"id": "s1"}, {"_id": 0})
    propuesta = await db.stats_proposals.find_one({"id": "pr1"}, {"_id": 0})
    assert final["values"] == {"goals": 3, "saves": 1}
    assert propuesta["values"] == {"goals": 2, "assists": 1}
    # Las columnas viejas quedan: la migración es aditiva.
    assert final["goals"] == 3


async def test_la_migracion_le_pone_a_cada_partido_lo_que_sigue(mongo_en_memoria):
    db = mongo_en_memoria
    await db.matches.insert_one({
        "id": "m-viejo",
        "group_id": "g",
        "organizer_id": "p",
        "title": "Viejo",
        "modality": 5,
        "date": "2026-01-10",
        "time": "20:00",
        "location": "La cancha",
        "deadline": "2026-01-10T12:00:00+00:00",
        "status": "abierto",
        "is_recurring": False,
        "max_players": 10,
        "created_at": "2026-01-01T00:00:00+00:00",
    })

    await database.backfill_match_defaults()

    doc = await db.matches.find_one({"id": "m-viejo"}, {"_id": 0})
    # Migra a avanzado, y avanzado sigue las tres de siempre: exactamente lo que
    # ese partido ya tenía cargado.
    assert doc["mode"] == "avanzado"
    assert doc["tracked_stats"] == list(CLASSIC_TRACKED_STATS)


# ---------------------------------------------------------------------------
# El bonus del rating
# ---------------------------------------------------------------------------

def test_las_estadisticas_de_exposicion_no_mueven_el_puntaje():
    """Cortes, duelos y regates miden cuánto tocás la pelota, no qué tan bien jugás."""
    solo_expuestas = [{"values": {"tackles": 10, "duels_won": 10, "dribbles_won": 10}}]
    assert rating_calculator._calculate_stats_bonus(solo_expuestas) == 0.0


def test_el_bonus_da_lo_mismo_en_los_dos_formatos():
    """Un historial ya guardado no puede cambiar de valor al migrar."""
    viejo = [{"goals": 2, "assists": 1, "saves": 0}]
    nuevo = [{"values": {"goals": 2, "assists": 1}}]
    assert rating_calculator._calculate_stats_bonus(viejo) == pytest.approx(
        rating_calculator._calculate_stats_bonus(nuevo)
    )


def test_una_planilla_larga_no_pesa_mas_por_tener_mas_columnas():
    llena = [{"values": {
        "goals": 5, "assists": 5, "saves": 5, "tackles": 20,
        "duels_won": 20, "dribbles_won": 20, "key_passes": 20,
    }}]
    assert rating_calculator._calculate_stats_bonus(llena) == 1.0


async def test_las_metricas_acumulan_todas_las_estadisticas(mongo_en_memoria):
    db = mongo_en_memoria
    _, jugador = await sembrar_jugador(db, "Goleador")
    for goles, cortes in ((2, 3), (1, 4)):
        await db.stats_final.insert_one({
            "id": str(uuid.uuid4()),
            "match_id": str(uuid.uuid4()),
            "player_id": jugador,
            "values": {"goals": goles, "tackles": cortes},
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
        })

    metricas = await rating_calculator.calculate_player_metrics(jugador)

    assert metricas["totals"] == {"goals": 3, "tackles": 7}
    # Los tres de siempre siguen viajando con su nombre.
    assert metricas["total_goals"] == 3
    assert metricas["total_assists"] == 0


def test_las_capacidades_de_pro_y_avanzado_solo_difieren_en_estadisticas():
    """Si algún día divergen en otra cosa, que se entere un test y no un usuario."""
    pro = capacidades_de("pro")
    avanzado = capacidades_de("avanzado")
    distintas = {k for k in pro if pro[k] != avanzado[k]}
    assert distintas == {"stats_configurables", "stats_source"}
