"""
Tests del enganche entre torneos y partidos, y de los penales.

Dos cosas se cuidan acá por encima de todo:

1. LA ORIENTACIÓN. Un fixture habla desde el equipo local ("3 a 1"); el partido
   del grupo visitante tiene que decir "1 a 3". Darlo vuelta al revés es el error
   que nadie encuentra despues, porque el numero igual se ve bien.

2. QUE HAYA UN SOLO DUEÑO DEL RESULTADO. El fixture manda y los partidos reciben
   copia. Si cada partido escribiera el suyo, una llave con los dos grupos
   enlazados tendria dos escritores para el mismo marcador.

Los penales se suman aparte del marcador a proposito: antes la unica salida era
volver a cargar el resultado con los penales ya sumados a los goles, o sea que un
2-2 ganado 4-3 quedaba escrito 6-5 — y ese numero despues aparecia en la tabla de
posiciones y en el historial del jugador.
"""

from datetime import datetime, timezone
import uuid

import pytest
from fastapi import HTTPException

import routes_matches as rm
import routes_post_match as rpm
import routes_tournaments as rt
from models import (
    CreateFixtureMatchRequest,
    CreateTournamentRequest,
    SetFixtureResultRequest,
    SetMatchResultRequest,
)
from services.tournament import ganador_de, tabla_de_posiciones

AHORA = datetime.now(timezone.utc)


async def sembrar_organizador(db, nombre="Pato", role="organizador"):
    user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    await db.player_profiles.insert_one({
        "id": profile_id, "user_id": user_id, "name": nombre,
        "player_type": "frecuente", "matches_played": 0,
        "created_at": AHORA.isoformat(),
    })
    return {"user_id": user_id, "role": role}, profile_id


async def sembrar_grupo(db, profile_id, nombre):
    group_id = str(uuid.uuid4())
    await db.groups.insert_one({
        "id": group_id, "name": nombre, "created_by": profile_id,
        "created_at": AHORA.isoformat(),
    })
    await db.group_members.insert_one({
        "id": str(uuid.uuid4()), "group_id": group_id, "player_id": profile_id,
        "member_role": "organizador", "status": "activo",
        "created_at": AHORA.isoformat(),
    })
    return group_id


async def armar_torneo(db, formato="eliminacion", equipos=2):
    """Un torneo con su fixture ya generado. Devuelve (user, torneo, group_ids)."""
    user, profile_id = await sembrar_organizador(db)
    group_ids = [
        await sembrar_grupo(db, profile_id, f"Grupo {i}") for i in range(equipos)
    ]
    torneo = await rt.create_tournament(
        CreateTournamentRequest(name="Copa", format=formato, group_ids=group_ids),
        user=user,
    )
    await rt.generate_fixture(torneo["id"], user=user)
    return user, torneo, group_ids


async def primer_fixture(db, tournament_id):
    return await db.tournament_fixtures.find_one(
        {"tournament_id": tournament_id}, {"_id": 0}
    )


def pedido_de_partido(group_id, **extra):
    base = dict(
        group_id=group_id, modality=5, date="2026-09-05",
        time="20:00", location="La cancha",
    )
    base.update(extra)
    return CreateFixtureMatchRequest(**base)


# ---------------------------------------------------------------------------
# Penales
# ---------------------------------------------------------------------------

async def test_los_penales_definen_la_llave(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, _ = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])

    await rt.set_fixture_result(
        torneo["id"], fixture["id"],
        SetFixtureResultRequest(home_score=2, away_score=2, home_penalties=4, away_penalties=3),
        user=user,
    )

    actualizado = await primer_fixture(db, torneo["id"])
    assert ganador_de(actualizado) == fixture["home_team_id"]
    # El marcador de los noventa NO se toca: los penales van aparte.
    assert actualizado["home_score"] == 2
    assert actualizado["away_score"] == 2


async def test_el_empate_sin_penales_sigue_sin_definir(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, _ = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])

    await rt.set_fixture_result(
        torneo["id"], fixture["id"],
        SetFixtureResultRequest(home_score=1, away_score=1),
        user=user,
    )

    assert ganador_de(await primer_fixture(db, torneo["id"])) is None


async def test_los_penales_no_van_en_liga(mongo_en_memoria):
    """En liga el empate es un resultado válido y suma un punto a cada uno."""
    db = mongo_en_memoria
    user, torneo, _ = await armar_torneo(db, formato="liga", equipos=2)
    fixture = await primer_fixture(db, torneo["id"])

    with pytest.raises(HTTPException) as exc:
        await rt.set_fixture_result(
            torneo["id"], fixture["id"],
            SetFixtureResultRequest(home_score=1, away_score=1, home_penalties=5, away_penalties=4),
            user=user,
        )

    assert exc.value.status_code == 400
    assert "empate es un resultado válido" in exc.value.detail


async def test_no_se_cargan_penales_si_no_hubo_empate(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, _ = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])

    with pytest.raises(HTTPException) as exc:
        await rt.set_fixture_result(
            torneo["id"], fixture["id"],
            SetFixtureResultRequest(home_score=3, away_score=1, home_penalties=5, away_penalties=4),
            user=user,
        )

    assert "terminó empatado" in exc.value.detail


async def test_una_tanda_no_termina_empatada(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, _ = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])

    with pytest.raises(HTTPException) as exc:
        await rt.set_fixture_result(
            torneo["id"], fixture["id"],
            SetFixtureResultRequest(home_score=1, away_score=1, home_penalties=3, away_penalties=3),
            user=user,
        )

    assert "no termina empatada" in exc.value.detail


async def test_los_penales_no_ensucian_la_tabla(mongo_en_memoria):
    """Antes había que sumarlos a los goles, y aparecían en la diferencia de gol."""
    db = mongo_en_memoria
    user, torneo, _ = await armar_torneo(db, formato="liga", equipos=2)
    fixture = await primer_fixture(db, torneo["id"])
    await rt.set_fixture_result(
        torneo["id"], fixture["id"],
        SetFixtureResultRequest(home_score=2, away_score=2),
        user=user,
    )

    teams = await db.tournament_teams.find({"tournament_id": torneo["id"]}, {"_id": 0}).to_list(10)
    fixtures = await db.tournament_fixtures.find({"tournament_id": torneo["id"]}, {"_id": 0}).to_list(10)
    tabla = tabla_de_posiciones(teams, fixtures)

    assert all(fila["goals_for"] == 2 and fila["points"] == 1 for fila in tabla)


# ---------------------------------------------------------------------------
# Crear el partido de una llave
# ---------------------------------------------------------------------------

async def test_cada_grupo_crea_su_partido_de_la_llave(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])

    for group_id in grupos:
        await rt.crear_partido_de_fixture(
            torneo["id"], fixture["id"], pedido_de_partido(group_id), user=user
        )

    partidos = await db.matches.find({"fixture_id": fixture["id"]}, {"_id": 0}).to_list(10)
    assert len(partidos) == 2
    assert {p["fixture_side"] for p in partidos} == {"home", "away"}
    # Nacen en modo Entrenador, que es exactamente esta situación.
    assert all(p["mode"] == "entrenador" for p in partidos)
    # Y cada uno tiene al otro como rival.
    nombres = {p["fixture_side"]: p["opponent_name"] for p in partidos}
    assert nombres["home"] != nombres["away"]


async def test_el_partido_se_llama_como_el_rival(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])

    res = await rt.crear_partido_de_fixture(
        torneo["id"], fixture["id"], pedido_de_partido(grupos[0]), user=user
    )

    partido = await db.matches.find_one({"id": res["match_id"]}, {"_id": 0})
    assert partido["title"].startswith("vs ")
    assert partido["match_type"] == "oficial"


async def test_un_grupo_no_puede_crear_dos_veces_el_mismo_lado(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])
    await rt.crear_partido_de_fixture(
        torneo["id"], fixture["id"], pedido_de_partido(grupos[0]), user=user
    )

    with pytest.raises(HTTPException) as exc:
        await rt.crear_partido_de_fixture(
            torneo["id"], fixture["id"], pedido_de_partido(grupos[0]), user=user
        )

    assert "ya tiene su partido" in exc.value.detail


async def test_no_se_crea_el_partido_de_un_grupo_que_no_juega_la_llave(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, _ = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])
    _, otro_perfil = await sembrar_organizador(db, "Ajeno")
    ajeno = await sembrar_grupo(db, otro_perfil, "Los de al lado")

    with pytest.raises(HTTPException) as exc:
        await rt.crear_partido_de_fixture(
            torneo["id"], fixture["id"], pedido_de_partido(ajeno), user=user
        )

    assert "no juega esta llave" in exc.value.detail


# ---------------------------------------------------------------------------
# El resultado baja del fixture, orientado
# ---------------------------------------------------------------------------

async def test_el_resultado_baja_a_los_dos_partidos_dado_vuelta(mongo_en_memoria):
    """La prueba que más importa de todo el archivo."""
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])
    for group_id in grupos:
        await rt.crear_partido_de_fixture(
            torneo["id"], fixture["id"], pedido_de_partido(group_id), user=user
        )

    await rt.set_fixture_result(
        torneo["id"], fixture["id"],
        SetFixtureResultRequest(home_score=3, away_score=1),
        user=user,
    )

    partidos = await db.matches.find({"fixture_id": fixture["id"]}, {"_id": 0}).to_list(10)
    por_lado = {p["fixture_side"]: p["result"] for p in partidos}
    # El local le ganó 3 a 1...
    assert (por_lado["home"]["home_score"], por_lado["home"]["away_score"]) == (3, 1)
    # ...y para el visitante el mismo partido es 1 a 3.
    assert (por_lado["away"]["home_score"], por_lado["away"]["away_score"]) == (1, 3)
    assert all(r["from_fixture"] for r in por_lado.values())


async def test_los_penales_tambien_bajan_orientados(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])
    await rt.crear_partido_de_fixture(
        torneo["id"], fixture["id"], pedido_de_partido(grupos[1]), user=user
    )

    await rt.set_fixture_result(
        torneo["id"], fixture["id"],
        SetFixtureResultRequest(home_score=2, away_score=2, home_penalties=5, away_penalties=4),
        user=user,
    )

    partido = await db.matches.find_one({"fixture_id": fixture["id"]}, {"_id": 0})
    assert partido["fixture_side"] == "away"
    # Perdió por penales: desde su lado, 4 contra 5.
    assert partido["result"]["home_penalties"] == 4
    assert partido["result"]["away_penalties"] == 5


async def test_el_partido_creado_despues_nace_con_el_resultado_puesto(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])
    await rt.set_fixture_result(
        torneo["id"], fixture["id"],
        SetFixtureResultRequest(home_score=4, away_score=0),
        user=user,
    )

    res = await rt.crear_partido_de_fixture(
        torneo["id"], fixture["id"], pedido_de_partido(grupos[1]), user=user
    )

    partido = await db.matches.find_one({"id": res["match_id"]}, {"_id": 0})
    assert (partido["result"]["home_score"], partido["result"]["away_score"]) == (0, 4)


async def test_la_nota_del_partido_sobrevive_a_que_se_corrija_el_marcador(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])
    res = await rt.crear_partido_de_fixture(
        torneo["id"], fixture["id"], pedido_de_partido(grupos[0]), user=user
    )
    await db.matches.update_one(
        {"id": res["match_id"]},
        {"$set": {"status": "finalizado", "result": {"notes": "llovía"}}},
    )

    await rt.set_fixture_result(
        torneo["id"], fixture["id"],
        SetFixtureResultRequest(home_score=1, away_score=0),
        user=user,
    )

    partido = await db.matches.find_one({"id": res["match_id"]}, {"_id": 0})
    assert partido["result"]["notes"] == "llovía"
    assert partido["result"]["home_score"] == 1


# ---------------------------------------------------------------------------
# Cargarlo desde el partido
# ---------------------------------------------------------------------------

async def test_cargar_desde_el_partido_del_visitante_escribe_bien_la_llave(mongo_en_memoria):
    """La orientación, en el sentido contrario."""
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])
    res = await rt.crear_partido_de_fixture(
        torneo["id"], fixture["id"], pedido_de_partido(grupos[1]), user=user
    )
    await db.matches.update_one({"id": res["match_id"]}, {"$set": {"status": "finalizado"}})

    # Desde el lado del visitante: "les ganamos 2 a 0".
    await rpm.set_match_result(
        res["match_id"], SetMatchResultRequest(home_score=2, away_score=0), user=user
    )

    actualizado = await primer_fixture(db, torneo["id"])
    # En la llave eso es 0 a 2 para el local, y pasa el visitante.
    assert (actualizado["home_score"], actualizado["away_score"]) == (0, 2)
    assert ganador_de(actualizado) == fixture["away_team_id"]


async def test_cargar_desde_el_partido_cierra_el_torneo(mongo_en_memoria):
    """La cascada corre igual, venga de donde venga el resultado."""
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])
    res = await rt.crear_partido_de_fixture(
        torneo["id"], fixture["id"], pedido_de_partido(grupos[0]), user=user
    )
    await db.matches.update_one({"id": res["match_id"]}, {"$set": {"status": "finalizado"}})

    await rpm.set_match_result(
        res["match_id"], SetMatchResultRequest(home_score=3, away_score=1), user=user
    )

    doc = await db.tournaments.find_one({"id": torneo["id"]}, {"_id": 0})
    assert doc["status"] == "finalizado"
    assert doc["champion_team_id"] == fixture["home_team_id"]


async def test_un_partido_suelto_no_acepta_penales(mongo_en_memoria):
    db = mongo_en_memoria
    user, profile_id = await sembrar_organizador(db)
    group_id = await sembrar_grupo(db, profile_id, "Los del martes")
    partido = await rm.create_match(
        rm.CreateMatchRequest(
            group_id=group_id, title="Interno", modality=5, date="2026-09-05",
            time="20:00", location="La cancha",
        ),
        user=user,
    )
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "finalizado"}})

    with pytest.raises(HTTPException) as exc:
        await rpm.set_match_result(
            partido.id,
            SetMatchResultRequest(home_score=1, away_score=1, home_penalties=4, away_penalties=3),
            user=user,
        )

    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# Corregir y borrar
# ---------------------------------------------------------------------------

async def test_corregir_una_llave_de_arriba_limpia_los_partidos_de_abajo(mongo_en_memoria):
    """Se jugó contra otro rival: ese resultado ya no significa nada."""
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db, equipos=4)
    fixtures = await db.tournament_fixtures.find(
        {"tournament_id": torneo["id"]}, {"_id": 0}
    ).sort("round", 1).to_list(10)
    semis = [fx for fx in fixtures if fx.get("next_fixture_id")]
    final = next(fx for fx in fixtures if not fx.get("next_fixture_id"))

    for semi in semis:
        await rt.set_fixture_result(
            torneo["id"], semi["id"],
            SetFixtureResultRequest(home_score=2, away_score=0), user=user,
        )

    final_actual = await db.tournament_fixtures.find_one({"id": final["id"]}, {"_id": 0})
    grupo_finalista = next(
        t["group_id"] for t in await db.tournament_teams.find(
            {"id": final_actual["home_team_id"]}, {"_id": 0}
        ).to_list(1)
    )
    creado = await rt.crear_partido_de_fixture(
        torneo["id"], final["id"], pedido_de_partido(grupo_finalista), user=user
    )
    await rt.set_fixture_result(
        torneo["id"], final["id"],
        SetFixtureResultRequest(home_score=1, away_score=0), user=user,
    )
    assert (await db.matches.find_one({"id": creado["match_id"]}, {"_id": 0}))["result"] is not None

    # Se corrige una semi y cambia quien llega a la final.
    await rt.set_fixture_result(
        torneo["id"], semis[0]["id"],
        SetFixtureResultRequest(home_score=0, away_score=2), user=user,
    )

    partido = await db.matches.find_one({"id": creado["match_id"]}, {"_id": 0})
    assert partido["result"] is None


async def test_no_se_regenera_el_fixture_con_partidos_enlazados(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db, formato="liga", equipos=2)
    fixture = await primer_fixture(db, torneo["id"])
    await rt.crear_partido_de_fixture(
        torneo["id"], fixture["id"], pedido_de_partido(grupos[0]), user=user
    )

    with pytest.raises(HTTPException) as exc:
        await rt.generate_fixture(torneo["id"], user=user)

    assert "Desenlazalos" in exc.value.detail


async def test_borrar_el_torneo_suelta_los_partidos_pero_no_los_borra(mongo_en_memoria):
    """Adentro tienen inscriptos, asistencia y evaluaciones del grupo."""
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])
    creado = await rt.crear_partido_de_fixture(
        torneo["id"], fixture["id"], pedido_de_partido(grupos[0]), user=user
    )

    await rt.delete_tournament(torneo["id"], user=user)

    partido = await db.matches.find_one({"id": creado["match_id"]}, {"_id": 0})
    assert partido is not None
    assert "fixture_id" not in partido
    assert "tournament_id" not in partido


async def test_desenlazar_uno_no_suelta_el_del_otro_grupo(mongo_en_memoria):
    db = mongo_en_memoria
    user, torneo, grupos = await armar_torneo(db)
    fixture = await primer_fixture(db, torneo["id"])
    mio = await rt.crear_partido_de_fixture(
        torneo["id"], fixture["id"], pedido_de_partido(grupos[0]), user=user
    )
    del_otro = await rt.crear_partido_de_fixture(
        torneo["id"], fixture["id"], pedido_de_partido(grupos[1]), user=user
    )

    await rt.desenlazar_partido_de_fixture(
        torneo["id"], fixture["id"], mio["match_id"], user=user
    )

    suelto = await db.matches.find_one({"id": mio["match_id"]}, {"_id": 0})
    sigue = await db.matches.find_one({"id": del_otro["match_id"]}, {"_id": 0})
    assert "fixture_id" not in suelto
    assert sigue["fixture_id"] == fixture["id"]
