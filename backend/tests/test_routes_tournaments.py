"""
Tests de las rutas de torneo, contra un Mongo en memoria.

Por qué existen: `services/tournament.py` (el motor) ya estaba cubierto, pero
todo lo que vive en las rutas — permisos, transiciones de estado, y sobre todo
la CASCADA de las llaves cuando se corrige un resultado — no tenía un solo test.
Los dos bugs más serios que aparecieron en la revisión estaban justamente ahí y
se encontraron leyendo código, no ejecutándolo. Estos tests los fijan.

Cómo funciona el armado: las rutas hacen `from database import db` al importarse,
así que el nombre `db` queda atado en cada módulo. Por eso el fixture parchea
`db` en CADA módulo que lo usa y no en `database` (ver `mongo_en_memoria`).

Se llama a las funciones de ruta directamente en vez de pasar por TestClient:
lo que se quiere probar es la lógica, no el ruteo de FastAPI ni el JWT. El
parámetro `user` es el dict que normalmente inyecta `get_current_user`.
"""

from datetime import datetime, timezone
import uuid

import pytest
from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient

import routes_tournaments as rt
from services import permissions as perms
from services import profiles as profs
from services.tournament import ganador_de


@pytest.fixture
def mongo_en_memoria(monkeypatch):
    """
    Reemplaza `db` por un Mongo en memoria, limpio para cada test.

    Se parchea en los tres módulos que hacen `from database import db`. Si
    mañana una ruta de torneo empieza a apoyarse en otro service, hay que
    sumarlo acá o el test va a estar pegándole al Atlas de verdad.
    """
    fake = AsyncMongoMockClient()["test"]
    for modulo in (rt, perms, profs):
        monkeypatch.setattr(modulo, "db", fake)
    return fake


async def sembrar_organizador(db, nombre="Pato", role="organizador"):
    """Un usuario con perfil. Devuelve (user, profile_id)."""
    user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    await db.player_profiles.insert_one({
        "id": profile_id,
        "user_id": user_id,
        "name": nombre,
        "player_type": "frecuente",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"user_id": user_id, "role": role}, profile_id


async def sembrar_grupo(db, profile_id, nombre, member_role="organizador"):
    """Un grupo con `profile_id` adentro. Devuelve el group_id."""
    group_id = str(uuid.uuid4())
    await db.groups.insert_one({
        "id": group_id,
        "name": nombre,
        "created_by": profile_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.group_members.insert_one({
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "player_id": profile_id,
        "member_role": member_role,
        "status": "activo",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return group_id


async def armar_torneo(db, user, profile_id, cantidad, formato, **extra):
    """Crea N grupos y un torneo que los agrupa. Devuelve el torneo serializado."""
    group_ids = [
        await sembrar_grupo(db, profile_id, f"Grupo {i}") for i in range(cantidad)
    ]
    data = rt.CreateTournamentRequest(
        name=f"Copa {formato}", format=formato, group_ids=group_ids, **extra
    )
    return await rt.create_tournament(data, user=user)


async def fixtures_de(db, tournament_id):
    return await db.tournament_fixtures.find(
        {"tournament_id": tournament_id}, {"_id": 0}
    ).sort([("round", 1), ("order", 1)]).to_list(500)


async def cargar(tournament_id, fixture_id, local, visitante, user):
    return await rt.set_fixture_result(
        tournament_id,
        fixture_id,
        rt.SetFixtureResultRequest(home_score=local, away_score=visitante),
        user=user,
    )


class TestAlta:
    async def test_crea_el_torneo_con_sus_grupos(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)

        torneo = await armar_torneo(db, user, profile_id, 4, "liga")

        assert torneo["teams_count"] == 4
        assert torneo["status"] == "borrador"
        assert torneo["can_manage"] is True
        assert torneo["rejected_groups"] == []

    async def test_un_jugador_comun_no_puede_crear_torneos(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, _ = await sembrar_organizador(db, role="jugador")

        with pytest.raises(HTTPException) as exc:
            await rt.create_tournament(
                rt.CreateTournamentRequest(name="Copa", format="liga"), user=user
            )
        assert exc.value.status_code == 403

    async def test_no_se_puede_sumar_un_grupo_que_no_organizo(self, mongo_en_memoria):
        """El grupo ajeno se rechaza, pero el torneo igual queda creado."""
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        _, otro_profile = await sembrar_organizador(db, nombre="Otro")

        mío = await sembrar_grupo(db, profile_id, "El mío")
        ajeno = await sembrar_grupo(db, otro_profile, "El de otro")

        torneo = await rt.create_tournament(
            rt.CreateTournamentRequest(
                name="Copa", format="liga", group_ids=[mío, ajeno]
            ),
            user=user,
        )

        assert torneo["teams_count"] == 1
        assert [r["group_id"] for r in torneo["rejected_groups"]] == [ajeno]

    async def test_los_grupos_repetidos_entran_una_sola_vez(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        grupo = await sembrar_grupo(db, profile_id, "Único")

        torneo = await rt.create_tournament(
            rt.CreateTournamentRequest(
                name="Copa", format="liga", group_ids=[grupo, grupo, grupo]
            ),
            user=user,
        )
        assert torneo["teams_count"] == 1


class TestPermisos:
    async def test_un_ajeno_no_ve_el_torneo(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        ajeno, _ = await sembrar_organizador(db, nombre="Ajeno")

        torneo = await armar_torneo(db, user, profile_id, 2, "liga")

        with pytest.raises(HTTPException) as exc:
            await rt.get_tournament(torneo["id"], user=ajeno)
        assert exc.value.status_code == 403

    async def test_quien_juega_el_torneo_lo_ve(self, mongo_en_memoria):
        """Miembro de un grupo que participa, aunque no lo organice."""
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        jugador, jugador_profile = await sembrar_organizador(db, nombre="Jugador")

        torneo = await armar_torneo(db, user, profile_id, 2, "liga")
        equipos = await db.tournament_teams.find(
            {"tournament_id": torneo["id"]}, {"_id": 0}
        ).to_list(10)

        await db.group_members.insert_one({
            "id": str(uuid.uuid4()),
            "group_id": equipos[0]["group_id"],
            "player_id": jugador_profile,
            "member_role": "frecuente",
            "status": "activo",
            "created_at": "2026-01-01",
        })

        visto = await rt.get_tournament(torneo["id"], user=jugador)
        assert visto["tournament"]["can_manage"] is False

    async def test_quien_no_lo_creo_no_puede_cargar_resultados(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        ajeno, _ = await sembrar_organizador(db, nombre="Ajeno")

        torneo = await armar_torneo(db, user, profile_id, 2, "liga")
        await rt.generate_fixture(torneo["id"], user=user)
        fx = (await fixtures_de(db, torneo["id"]))[0]

        with pytest.raises(HTTPException) as exc:
            await cargar(torneo["id"], fx["id"], 1, 0, ajeno)
        assert exc.value.status_code == 403


class TestFixtureDeLiga:
    async def test_genera_todos_contra_todos_y_arranca(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 4, "liga")

        res = await rt.generate_fixture(torneo["id"], user=user)

        assert len(res["fixtures"]) == 6  # 4 equipos: 4*3/2
        assert res["status"] == "fase_grupos"

    async def test_con_un_solo_equipo_no_hay_torneo(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 1, "liga")

        with pytest.raises(HTTPException) as exc:
            await rt.generate_fixture(torneo["id"], user=user)
        assert exc.value.status_code == 400

    async def test_no_se_regenera_el_fixture_con_resultados_cargados(self, mongo_en_memoria):
        """Regenerar borraría lo jugado, así que se rechaza."""
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 4, "liga")
        await rt.generate_fixture(torneo["id"], user=user)

        fx = (await fixtures_de(db, torneo["id"]))[0]
        await cargar(torneo["id"], fx["id"], 2, 1, user)

        with pytest.raises(HTTPException) as exc:
            await rt.generate_fixture(torneo["id"], user=user)
        assert exc.value.status_code == 400

    async def test_no_se_suman_equipos_despues_de_arrancar(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 2, "liga")
        await rt.generate_fixture(torneo["id"], user=user)

        nuevo = await sembrar_grupo(db, profile_id, "Tardío")
        with pytest.raises(HTTPException) as exc:
            await rt.add_tournament_team(
                torneo["id"], rt.AddTournamentTeamRequest(group_id=nuevo), user=user
            )
        assert exc.value.status_code == 400

    async def test_el_resultado_mueve_la_tabla(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 4, "liga")
        await rt.generate_fixture(torneo["id"], user=user)

        fx = (await fixtures_de(db, torneo["id"]))[0]
        res = await cargar(torneo["id"], fx["id"], 3, 1, user)

        ganador = next(f for f in res["standings"] if f["team_id"] == fx["home_team_id"])
        assert ganador["points"] == 3
        assert ganador["goal_diff"] == 2

    async def test_al_terminar_la_liga_hay_campeon(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 3, "liga")
        await rt.generate_fixture(torneo["id"], user=user)

        for fx in await fixtures_de(db, torneo["id"]):
            res = await cargar(torneo["id"], fx["id"], 1, 0, user)

        assert res["tournament"]["status"] == "finalizado"
        assert res["tournament"]["champion_team_id"] is not None


class TestLlaves:
    async def test_corregir_un_resultado_limpia_la_ronda_siguiente(self, mongo_en_memoria):
        """
        El bug que motivó la cascada.

        Con 4 equipos: se juegan las dos semis, se juega la final y queda un
        campeón. Después se corrige una semi dando vuelta el ganador. La final
        se jugó contra un equipo que ya no está: tiene que quedar SIN resultado,
        con el clasificado nuevo sentado, y el campeón anulado. Antes de la
        cascada, el perdedor de la semi corregida seguía figurando de campeón.
        """
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 4, "eliminacion")
        await rt.generate_fixture(torneo["id"], user=user)

        todos = await fixtures_de(db, torneo["id"])
        semis = [f for f in todos if f["stage"] == "semifinal"]
        assert len(semis) == 2

        await cargar(torneo["id"], semis[0]["id"], 2, 0, user)
        await cargar(torneo["id"], semis[1]["id"], 1, 0, user)

        final = next(f for f in await fixtures_de(db, torneo["id"]) if f["stage"] == "final")
        assert final["home_team_id"] and final["away_team_id"]

        res = await cargar(torneo["id"], final["id"], 3, 2, user)
        campeon_viejo = res["tournament"]["champion_team_id"]
        assert campeon_viejo == final["home_team_id"]

        # Se da vuelta la primera semi: ahora pasa el otro.
        perdedor_semi = semis[0]["away_team_id"]
        res = await cargar(torneo["id"], semis[0]["id"], 0, 2, user)

        final_ahora = next(f for f in res["fixtures"] if f["stage"] == "final")
        assert final_ahora["home_team_id"] == perdedor_semi
        assert final_ahora["status"] == "pendiente"
        assert final_ahora["home_score"] is None
        assert final_ahora["away_score"] is None
        assert res["tournament"]["champion_team_id"] is None
        assert res["tournament"]["status"] == "eliminatoria"

    async def test_un_empate_en_una_llave_deja_la_butaca_vacia(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 4, "eliminacion")
        await rt.generate_fixture(torneo["id"], user=user)

        semis = [f for f in await fixtures_de(db, torneo["id"]) if f["stage"] == "semifinal"]
        await cargar(torneo["id"], semis[0]["id"], 2, 0, user)
        res = await cargar(torneo["id"], semis[0]["id"], 1, 1, user)

        final = next(f for f in res["fixtures"] if f["stage"] == "final")
        assert final["home_team_id"] is None

    async def test_no_se_carga_una_llave_sin_los_dos_equipos(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 4, "eliminacion")
        await rt.generate_fixture(torneo["id"], user=user)

        final = next(f for f in await fixtures_de(db, torneo["id"]) if f["stage"] == "final")
        with pytest.raises(HTTPException) as exc:
            await cargar(torneo["id"], final["id"], 1, 0, user)
        assert exc.value.status_code == 400

    async def test_ganar_la_final_corona(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 2, "eliminacion")
        await rt.generate_fixture(torneo["id"], user=user)

        final = (await fixtures_de(db, torneo["id"]))[0]
        res = await cargar(torneo["id"], final["id"], 2, 1, user)

        assert res["tournament"]["status"] == "finalizado"
        assert res["tournament"]["champion_team_id"] == final["home_team_id"]
        assert ganador_de(res["fixtures"][0]) == final["home_team_id"]


class TestZonasYEliminatoria:
    async def _torneo_de_zonas(self, db, user, profile_id):
        torneo = await armar_torneo(
            db, user, profile_id, 4, "zonas_eliminatoria",
            zones_count=2, qualifiers_per_zone=1,
        )
        await rt.generate_fixture(torneo["id"], user=user)
        return torneo

    async def test_las_zonas_quedan_asignadas(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await self._torneo_de_zonas(db, user, profile_id)

        equipos = await db.tournament_teams.find(
            {"tournament_id": torneo["id"]}, {"_id": 0}
        ).to_list(10)
        assert {e["zone"] for e in equipos} == {"A", "B"}

    async def test_no_se_arman_las_llaves_con_la_fase_a_medias(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await self._torneo_de_zonas(db, user, profile_id)

        with pytest.raises(HTTPException) as exc:
            await rt.generate_playoffs(torneo["id"], user=user)
        assert exc.value.status_code == 400
        assert "Faltan" in exc.value.detail

    async def test_las_llaves_salen_de_los_clasificados(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await self._torneo_de_zonas(db, user, profile_id)

        for fx in await fixtures_de(db, torneo["id"]):
            await cargar(torneo["id"], fx["id"], 2, 0, user)

        res = await rt.generate_playoffs(torneo["id"], user=user)

        assert len(res["qualified"]) == 2  # el ganador de cada zona
        assert [f["stage"] for f in res["fixtures"]] == ["final"]

    async def test_regenerar_las_llaves_no_borra_lo_ya_jugado(self, mongo_en_memoria):
        """
        El segundo bug: `generate_playoffs` no tenía el resguardo que sí tenía
        `generate_fixture`, así que un doble click se llevaba puesta la final
        cargada y la regeneraba vacía, en silencio.
        """
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await self._torneo_de_zonas(db, user, profile_id)

        for fx in await fixtures_de(db, torneo["id"]):
            await cargar(torneo["id"], fx["id"], 2, 0, user)
        await rt.generate_playoffs(torneo["id"], user=user)

        final = next(f for f in await fixtures_de(db, torneo["id"]) if f["stage"] == "final")
        await cargar(torneo["id"], final["id"], 1, 0, user)

        with pytest.raises(HTTPException) as exc:
            await rt.generate_playoffs(torneo["id"], user=user)
        assert exc.value.status_code == 400

        # Y lo jugado sigue ahí.
        sigue = next(f for f in await fixtures_de(db, torneo["id"]) if f["stage"] == "final")
        assert sigue["status"] == "jugado"
        assert sigue["home_score"] == 1

    async def test_una_liga_no_tiene_llaves(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 3, "liga")
        await rt.generate_fixture(torneo["id"], user=user)

        with pytest.raises(HTTPException) as exc:
            await rt.generate_playoffs(torneo["id"], user=user)
        assert exc.value.status_code == 400


class TestBorrado:
    async def test_borrar_el_torneo_se_lleva_fixture_y_equipos(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 4, "liga")
        await rt.generate_fixture(torneo["id"], user=user)

        await rt.delete_tournament(torneo["id"], user=user)

        assert await db.tournaments.count_documents({"id": torneo["id"]}) == 0
        assert await db.tournament_teams.count_documents({"tournament_id": torneo["id"]}) == 0
        assert await db.tournament_fixtures.count_documents({"tournament_id": torneo["id"]}) == 0

    async def test_borrar_no_toca_los_grupos(self, mongo_en_memoria):
        """Un torneo agrupa grupos; borrarlo no puede borrar a la gente."""
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        torneo = await armar_torneo(db, user, profile_id, 3, "liga")

        await rt.delete_tournament(torneo["id"], user=user)

        assert await db.groups.count_documents({}) == 3
        assert await db.group_members.count_documents({"status": "activo"}) == 3

    async def test_un_ajeno_no_puede_borrarlo(self, mongo_en_memoria):
        db = mongo_en_memoria
        user, profile_id = await sembrar_organizador(db)
        ajeno, _ = await sembrar_organizador(db, nombre="Ajeno")
        torneo = await armar_torneo(db, user, profile_id, 2, "liga")

        with pytest.raises(HTTPException) as exc:
            await rt.delete_tournament(torneo["id"], user=ajeno)
        assert exc.value.status_code == 403
