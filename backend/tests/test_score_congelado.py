"""
Tests del puntaje congelado en `team_generations`.

`match_outcomes` guarda evidencia y no conclusiones, y la pieza que evita que la
evidencia sea circular es `player_score`: cuánto valía cada jugador CUANDO SE
ARMARON LOS EQUIPOS. Con eso, "qué esperábamos" se contesta con lo que creíamos
en ese momento y no con lo que creemos ahora, que ya está movido por el propio
resultado.

Había dos filtraciones por las que el rating de hoy se colaba adentro de ese
número:

1. El GET recalculaba en vivo cuando el guardado faltaba, y devolvía el valor
   recalculado con el mismo nombre que el congelado: indistinguibles.
2. El PUT persistía lo que mandaba el cliente. Sumadas, el organizador que
   retoca los equipos de un partido ya jugado blanqueaba el rating post-resultado
   como si fuera pre-resultado, y `recalcular_outcomes` corría con eso.

La regla que fijan estos tests: **el puntaje congelado es dato del servidor y
ningún request lo escribe.** El ajuste manual mueve jugadores de equipo y de
posición; no reescribe la historia.
"""

from datetime import datetime, timezone
import uuid

import pytest

import routes_teams as rt
from models import ManualAdjustRequest, TeamAssignmentModel

AHORA = datetime.now(timezone.utc)


async def sembrar_jugador(db, nombre, *, role="organizador"):
    user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    await db.player_profiles.insert_one({
        "id": profile_id,
        "user_id": user_id,
        "name": nombre,
        "player_type": "frecuente",
        "matches_played": 10,
        "created_at": AHORA.isoformat(),
    })
    return {"user_id": user_id, "role": role}, profile_id


async def sembrar_escenario(db, *, con_resultado=False, scores=(8.0, 4.0)):
    """Un partido con equipos generados y dos jugadores de puntaje bien distinto.

    Los puntajes son deliberadamente asimétricos: si algo los aplasta al prior
    neutro o los recalcula, la diferencia se nota en la aserción.
    """
    organizador, org_id = await sembrar_jugador(db, "Orga")
    _, otro_id = await sembrar_jugador(db, "Otro")

    group_id = str(uuid.uuid4())
    await db.groups.insert_one({
        "id": group_id, "name": "Los del martes",
        "created_by": org_id, "created_at": AHORA.isoformat(),
    })
    for pid in (org_id, otro_id):
        await db.group_members.insert_one({
            "id": str(uuid.uuid4()), "group_id": group_id, "player_id": pid,
            "member_role": "organizador" if pid == org_id else "frecuente",
            "status": "activo", "created_at": AHORA.isoformat(),
        })

    match_id = str(uuid.uuid4())
    match = {
        "id": match_id,
        "group_id": group_id,
        "organizer_id": org_id,
        "title": "Partido del sábado",
        "modality": 5,
        "date": "2026-08-01",
        "mode": "avanzado",
        "status": "equipos_generados",
        "counted_player_ids": [],
        "created_at": AHORA.isoformat(),
    }
    if con_resultado:
        match["status"] = "finalizado"
        match["result"] = {"home_score": 3, "away_score": 1, "loaded_at": AHORA.isoformat()}
        match["counted_player_ids"] = sorted([org_id, otro_id])
    await db.matches.insert_one(match)

    for pid in (org_id, otro_id):
        await db.match_registrations.insert_one({
            "id": str(uuid.uuid4()), "match_id": match_id, "player_id": pid,
            "status": "titular", "attendance": "presente", "order": 1,
            "registered_at": AHORA.isoformat(),
        })

    await db.team_generations.insert_one({
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "formation_a": None,
        "formation_b": None,
        "status": "borrador",
        "balance_score": 0.8,
        "assignments": [
            {"player_id": org_id, "player_name": "Orga", "player_score": scores[0],
             "team": "A", "position": "ST", "role": "titular", "is_manual": False},
            {"player_id": otro_id, "player_name": "Otro", "player_score": scores[1],
             "team": "B", "position": "GK", "role": "titular", "is_manual": False},
        ],
        "created_at": AHORA.isoformat(),
    })

    return organizador, match_id, org_id, otro_id


async def scores_guardados(db, match_id):
    gen = await db.team_generations.find_one({"match_id": match_id}, {"_id": 0})
    return {a["player_id"]: a.get("player_score") for a in gen["assignments"]}


@pytest.mark.asyncio
async def test_el_cliente_no_puede_pisar_el_puntaje_congelado(mongo_en_memoria):
    """Un payload con puntajes inventados no los escribe."""
    db = mongo_en_memoria
    user, match_id, org_id, otro_id = await sembrar_escenario(db)

    await rt.adjust_teams(match_id, ManualAdjustRequest(assignments=[
        TeamAssignmentModel(player_id=org_id, player_name="Orga", player_score=1.0,
                            team="B", position="ST"),
        TeamAssignmentModel(player_id=otro_id, player_name="Otro", player_score=9.9,
                            team="A", position="GK"),
    ]), user=user)

    guardados = await scores_guardados(db, match_id)
    assert guardados[org_id] == 8.0
    assert guardados[otro_id] == 4.0


@pytest.mark.asyncio
async def test_un_payload_sin_puntaje_no_lo_borra(mongo_en_memoria):
    """El caso del cliente que no es esta app: omitir el campo no blanquea el ancla.

    `player_score` es opcional en el modelo, así que un curl o un cliente móvil
    futuro puede no mandarlo. Antes eso dejaba el partido entero sin puntaje
    congelado, y el cálculo caía al prior neutro para los dos equipos.
    """
    db = mongo_en_memoria
    user, match_id, org_id, otro_id = await sembrar_escenario(db)

    await rt.adjust_teams(match_id, ManualAdjustRequest(assignments=[
        TeamAssignmentModel(player_id=org_id, player_name="Orga", team="A", position="CB"),
        TeamAssignmentModel(player_id=otro_id, player_name="Otro", team="B", position="GK"),
    ]), user=user)

    guardados = await scores_guardados(db, match_id)
    assert guardados[org_id] == 8.0
    assert guardados[otro_id] == 4.0


@pytest.mark.asyncio
async def test_el_ajuste_manual_sigue_moviendo_al_jugador(mongo_en_memoria):
    """Lo que el ajuste SÍ tiene que poder cambiar sigue funcionando."""
    db = mongo_en_memoria
    user, match_id, org_id, otro_id = await sembrar_escenario(db)

    await rt.adjust_teams(match_id, ManualAdjustRequest(assignments=[
        TeamAssignmentModel(player_id=org_id, player_name="Orga", team="B",
                            position="CB", role="suplente", is_manual=True),
        TeamAssignmentModel(player_id=otro_id, player_name="Otro", team="A", position="ST"),
    ]), user=user)

    gen = await db.team_generations.find_one({"match_id": match_id}, {"_id": 0})
    por_jugador = {a["player_id"]: a for a in gen["assignments"]}
    assert por_jugador[org_id]["team"] == "B"
    assert por_jugador[org_id]["position"] == "CB"
    assert por_jugador[org_id]["role"] == "suplente"
    assert por_jugador[org_id]["is_manual"] is True
    assert por_jugador[otro_id]["team"] == "A"


@pytest.mark.asyncio
async def test_una_asignacion_sin_puntaje_no_se_completa_con_el_rating_de_hoy(mongo_en_memoria):
    """El GET no rellena el hueco con el rating actual.

    Si lo rellenara y el front devolviera ese valor, el PUT lo persistiría como
    si fuera el congelado. Un hueco tiene que seguir siendo un hueco: la pantalla
    ya sabe mostrar "—".
    """
    db = mongo_en_memoria
    user, match_id, org_id, otro_id = await sembrar_escenario(db, scores=(None, 4.0))

    respuesta = await rt.get_match_teams(match_id, user=user)
    por_jugador = {a["player_id"]: a for a in respuesta["assignments"]}

    assert por_jugador[org_id]["player_score"] is None
    assert por_jugador[otro_id]["player_score"] == 4.0


@pytest.mark.asyncio
async def test_retocar_equipos_de_un_partido_jugado_no_mueve_la_expectativa(mongo_en_memoria):
    """El test que cierra el agujero completo.

    Con resultado ya cargado, mover un jugador de equipo SÍ tiene que recalcular
    los outcomes (cambió contra quién ganó cada uno). Lo que no puede cambiar es
    la expectativa, porque las fuerzas congeladas son las mismas de siempre.
    """
    db = mongo_en_memoria
    user, match_id, org_id, otro_id = await sembrar_escenario(db, con_resultado=True)

    await rt.adjust_teams(match_id, ManualAdjustRequest(assignments=[
        TeamAssignmentModel(player_id=org_id, player_name="Orga", player_score=5.0,
                            team="A", position="ST"),
        TeamAssignmentModel(player_id=otro_id, player_name="Otro", player_score=5.0,
                            team="B", position="GK"),
    ]), user=user)

    guardados = await scores_guardados(db, match_id)
    assert guardados[org_id] == 8.0, "el ajuste pisó el puntaje congelado"
    assert guardados[otro_id] == 4.0

    partido = await db.matches.find_one({"id": match_id}, {"_id": 0})
    esperado = (partido.get("result") or {}).get("expected_home")
    assert esperado is not None
    # 8.0 contra 4.0 es una diferencia grande: el local era claro favorito.
    # Si algo hubiera aplastado los puntajes, esto daría 0.5 clavado.
    assert esperado > 0.6, f"la expectativa se calculó con puntajes contaminados: {esperado}"
