"""
Tests de la fase 4: el modo Entrenador.

Dos piezas propias, y las dos son puntas de un mismo malentendido:

  1. El rival no está en la app. Es un nombre, no un equipo con jugadores. Eso
     cambia quién es "local" y "visitante" en el marcador, y — lo importante —
     hace que el resultado NO pueda mover el puntaje, porque no hay forma de
     saber qué se esperaba contra un rival del que no sabemos nada.

  2. El banco vive en la ALINEACIÓN, no en la inscripción. En esta app la palabra
     "suplente" significa dos cosas distintas y este archivo se asegura de que
     sigan separadas: `status: suplente` es "no entraste al cupo del partido",
     `role: suplente` es "sos del equipo y arrancás en el banco".
"""

from datetime import datetime, timezone
import uuid

import pytest

import routes_matches as rm
import routes_post_match as rpm
import routes_teams as rt
from constants import capacidades_de
from models import (
    CreateMatchRequest,
    ManualAdjustRequest,
    PeerRatingBatchRequest,
    SetMatchResultRequest,
    UpdateMatchRequest,
)

AHORA = datetime.now(timezone.utc)


async def sembrar_jugador(db, nombre="Jugador", puesto=None, role="organizador"):
    user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    await db.player_profiles.insert_one({
        "id": profile_id,
        "user_id": user_id,
        "name": nombre,
        "player_type": "frecuente",
        "primary_position": puesto,
        "secondary_positions": [],
        "matches_played": 0,
        "created_at": AHORA.isoformat(),
    })
    return {"user_id": user_id, "role": role}, profile_id


async def sembrar_grupo(db, profile_id, nombre="Los del martes"):
    group_id = str(uuid.uuid4())
    await db.groups.insert_one({
        "id": group_id,
        "name": nombre,
        "created_by": profile_id,
        "created_at": AHORA.isoformat(),
    })
    await db.group_members.insert_one({
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "player_id": profile_id,
        "member_role": "organizador",
        "status": "activo",
        "created_at": AHORA.isoformat(),
    })
    return group_id


async def armar_equipo(db, *, plantel=8, modalidad=5, rival="Los del club", puestos=None):
    """Un partido de DT con su plantel anotado. Devuelve (user, match, ids)."""
    user, dt = await sembrar_jugador(db, "DT")
    group_id = await sembrar_grupo(db, dt)
    partido = await rm.create_match(
        CreateMatchRequest(
            group_id=group_id,
            title="Contra el club",
            modality=modalidad,
            date="2026-09-05",
            time="20:00",
            location="La cancha",
            mode="entrenador",
            opponent_name=rival,
        ),
        user=user,
    )

    ids = []
    for i in range(plantel):
        puesto = puestos[i] if puestos and i < len(puestos) else None
        _, jugador = await sembrar_jugador(db, f"J{i}", puesto)
        await db.match_registrations.insert_one({
            "id": str(uuid.uuid4()),
            "match_id": partido.id,
            "player_id": jugador,
            "status": "titular",
            "order": i + 1,
            "registered_at": AHORA.isoformat(),
        })
        ids.append(jugador)

    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "cerrado"}})
    return user, partido, ids


# ---------------------------------------------------------------------------
# El rival
# ---------------------------------------------------------------------------

async def test_el_rival_se_guarda_y_se_muestra_en_el_marcador(mongo_en_memoria):
    db = mongo_en_memoria
    user, partido, _ = await armar_equipo(db, rival="Deportivo Español")

    detalle = await rm.get_match(partido.id, user=user)

    assert detalle["opponent_name"] == "Deportivo Español"
    # El local somos nosotros; el visitante, el rival.
    assert detalle["home_label"] == "Los del martes"
    assert detalle["away_label"] == "Deportivo Español"


async def test_sin_nombre_de_rival_el_marcador_igual_se_entiende(mongo_en_memoria):
    db = mongo_en_memoria
    user, partido, _ = await armar_equipo(db, rival=None)

    detalle = await rm.get_match(partido.id, user=user)

    assert detalle["opponent_name"] is None
    assert detalle["away_label"] == "Rival"


async def test_el_nombre_del_rival_se_corrige_despues(mongo_en_memoria):
    """Es una etiqueta, no una regla: se puede arreglar un typo el lunes."""
    db = mongo_en_memoria
    user, partido, _ = await armar_equipo(db, rival="Deportivo Epañol")
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "finalizado"}})

    await rm.update_match(partido.id, UpdateMatchRequest(opponent_name="Deportivo Español"), user=user)

    doc = await db.matches.find_one({"id": partido.id}, {"_id": 0})
    assert doc["opponent_name"] == "Deportivo Español"


async def test_el_duplicado_se_juega_contra_el_mismo(mongo_en_memoria):
    db = mongo_en_memoria
    user, partido, _ = await armar_equipo(db, rival="Deportivo Español")

    duplicado = await rm.duplicate_match(partido.id, user=user)

    doc = await db.matches.find_one({"id": duplicado["id"]}, {"_id": 0})
    assert doc["opponent_name"] == "Deportivo Español"
    assert doc["mode"] == "entrenador"


async def test_en_un_partido_interno_los_lados_siguen_siendo_a_y_b(mongo_en_memoria):
    """El cambio de etiquetas es del modo con rival externo, no de todos."""
    db = mongo_en_memoria
    user, dt = await sembrar_jugador(db, "Pato")
    group_id = await sembrar_grupo(db, dt)
    partido = await rm.create_match(
        CreateMatchRequest(
            group_id=group_id, title="Interno", modality=5, date="2026-09-05",
            time="20:00", location="La cancha", mode="avanzado",
        ),
        user=user,
    )

    detalle = await rm.get_match(partido.id, user=user)

    assert detalle["home_label"] == "Equipo A"
    assert detalle["away_label"] == "Equipo B"


# ---------------------------------------------------------------------------
# La alineación con banco
# ---------------------------------------------------------------------------

async def test_el_plantel_se_parte_en_once_y_banco(mongo_en_memoria):
    db = mongo_en_memoria
    user, partido, ids = await armar_equipo(db, plantel=8, modalidad=5)

    generacion = await rt.generate_match_teams(partido.id, user=user)

    titulares = [a for a in generacion.assignments if a.role == "titular"]
    banco = [a for a in generacion.assignments if a.role == "suplente"]
    # Un F5 son cinco en cancha; los otros tres al banco.
    assert len(titulares) == 5
    assert len(banco) == 3
    # Nadie queda afuera del plantel.
    assert len(generacion.assignments) == len(ids)


async def test_todos_juegan_de_nuestro_lado(mongo_en_memoria):
    db = mongo_en_memoria
    user, partido, _ = await armar_equipo(db)

    generacion = await rt.generate_match_teams(partido.id, user=user)

    assert {a.team for a in generacion.assignments} == {"A"}
    assert generacion.formation_b is None


async def test_el_arquero_natural_arranca_de_arquero(mongo_en_memoria):
    """El punto de partida respeta los puestos; después el DT hace lo que quiera."""
    db = mongo_en_memoria
    user, partido, ids = await armar_equipo(
        db, plantel=6, modalidad=5, puestos=["ST", "ST", "GK", "CB", "CB", "ST"]
    )

    generacion = await rt.generate_match_teams(partido.id, user=user)

    arqueros = [a for a in generacion.assignments if a.position == "GK" and a.role == "titular"]
    assert len(arqueros) == 1
    assert arqueros[0].player_id == ids[2]


async def test_con_plantel_justo_no_hay_banco(mongo_en_memoria):
    db = mongo_en_memoria
    user, partido, _ = await armar_equipo(db, plantel=5, modalidad=5)

    generacion = await rt.generate_match_teams(partido.id, user=user)

    assert all(a.role == "titular" for a in generacion.assignments)


async def test_con_menos_gente_que_puestos_igual_se_arma(mongo_en_memoria):
    """Faltar dos no puede dejar al DT sin alineación que editar."""
    db = mongo_en_memoria
    user, partido, ids = await armar_equipo(db, plantel=3, modalidad=5)

    generacion = await rt.generate_match_teams(partido.id, user=user)

    assert len(generacion.assignments) == 3
    assert all(a.role == "titular" for a in generacion.assignments)


async def test_el_dt_puede_mandar_a_alguien_al_banco(mongo_en_memoria):
    """El ajuste manual guarda el rol, que es la edición propia de este modo."""
    db = mongo_en_memoria
    user, partido, _ = await armar_equipo(db, plantel=6, modalidad=5)
    generacion = await rt.generate_match_teams(partido.id, user=user)

    asignaciones = [a.model_dump() for a in generacion.assignments]
    titular = next(a for a in asignaciones if a["role"] == "titular")
    suplente = next(a for a in asignaciones if a["role"] == "suplente")
    titular["role"], suplente["role"] = "suplente", "titular"

    actualizado = await rt.adjust_teams(
        partido.id, ManualAdjustRequest(assignments=asignaciones), user=user
    )

    por_jugador = {a["player_id"]: a for a in actualizado["assignments"]}
    assert por_jugador[titular["player_id"]]["role"] == "suplente"
    assert por_jugador[suplente["player_id"]]["role"] == "titular"


async def test_en_los_modos_sin_banco_son_todos_titulares(mongo_en_memoria):
    """El campo existe siempre, pero sólo lo mueve el modo que tiene banco."""
    db = mongo_en_memoria
    user, dt = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, dt)
    partido = await rm.create_match(
        CreateMatchRequest(
            group_id=group_id, title="Interno", modality=5, date="2026-09-05",
            time="20:00", location="La cancha", mode="avanzado",
        ),
        user=user,
    )
    for i in range(10):
        _, jugador = await sembrar_jugador(db, f"J{i}")
        await db.match_registrations.insert_one({
            "id": str(uuid.uuid4()), "match_id": partido.id, "player_id": jugador,
            "status": "titular", "order": i + 1, "registered_at": AHORA.isoformat(),
        })
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "cerrado"}})

    generacion = await rt.generate_match_teams(partido.id, user=user)

    assert all(a.role == "titular" for a in generacion.assignments)


# ---------------------------------------------------------------------------
# El resultado contra un rival desconocido
# ---------------------------------------------------------------------------

async def test_el_resultado_se_guarda_pero_no_mueve_el_puntaje(mongo_en_memoria):
    """
    Sin saber cuánto vale el rival no se puede calcular qué se esperaba, y sin
    eso el canal del resultado no tiene nada que medir. Asumir que el rival es
    promedio sería inventar la mitad de la cuenta, con un sesgo conocido: el
    equipo que juega contra rivales flojos le inflaría el puntaje a todos.
    """
    db = mongo_en_memoria
    user, partido, _ = await armar_equipo(db, plantel=6, modalidad=5)
    await rt.generate_match_teams(partido.id, user=user)
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "finalizado"}})

    res = await rpm.set_match_result(
        partido.id, SetMatchResultRequest(home_score=3, away_score=1), user=user
    )

    doc = await db.matches.find_one({"id": partido.id}, {"_id": 0})
    assert doc["result"]["home_score"] == 3
    assert res["rated_players"] == 0
    assert await db.match_outcomes.count_documents({"match_id": partido.id}) == 0


async def test_pero_las_evaluaciones_entre_pares_siguen_andando(mongo_en_memoria):
    """Son medidas individuales: no dependen de saber contra quién se jugó."""
    db = mongo_en_memoria
    user, partido, ids = await armar_equipo(db, plantel=6, modalidad=5)
    dt_profile = await db.player_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    await db.match_registrations.insert_one({
        "id": str(uuid.uuid4()), "match_id": partido.id, "player_id": dt_profile["id"],
        "status": "titular", "order": 99, "registered_at": AHORA.isoformat(),
    })
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "finalizado"}})

    # Se califica a todo el plantel y no a uno solo: desde el arreglo de
    # colusión hay que cubrir al menos el 60% de los que jugaron. Lo que este
    # test cuida es que el modo Entrenador NO bloquee las evaluaciones, no que
    # se pueda calificar a uno y listo.
    await rpm.submit_ratings(
        partido.id,
        PeerRatingBatchRequest(ratings=[
            {"rated_player_id": pid, "score": 7 + (i % 3)} for i, pid in enumerate(ids)
        ]),
        user=user,
    )

    assert await db.peer_ratings.count_documents({"match_id": partido.id}) == len(ids)


def test_las_capacidades_del_modo_dicen_lo_que_hace():
    """Si alguien cambia el catálogo sin querer, que lo diga un test."""
    caps = capacidades_de("entrenador")
    assert caps["team_source"] == "manual"
    assert caps["opponent"] == "externo"
    assert caps["tiene_banco"] is True
    # Sigue evaluando y con estadísticas configurables: lo único que pierde
    # respecto de Pro es el canal del resultado.
    assert caps["rating_por_partido"] is True
    assert caps["stats_configurables"] is True
