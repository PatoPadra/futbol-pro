"""
Tests del motor de torneos.

Todo lo que se prueba acá es puro (services/tournament.py no toca Mongo), así
que no hace falta base ni fixtures async. Lo que se cubre es lo que se rompe:
que nadie repita rival, que las zonas no se llenen de favoritos, que las llaves
con cantidades que no son potencia de dos no inventen partidos, y que la tabla
desempate siempre igual.
"""

import pytest

from services.tournament import (
    clasificados,
    fixture_de_eliminacion,
    fixture_de_liga,
    fixture_de_zonas,
    ganador_de,
    repartir_en_zonas,
    round_robin,
    tabla_de_posiciones,
)


def equipos(cantidad):
    return [{"id": f"t{i}", "name": f"Equipo {i}", "zone": None} for i in range(cantidad)]


class TestRoundRobin:
    @pytest.mark.parametrize("cantidad", [2, 3, 4, 5, 6, 7, 8])
    def test_todos_juegan_contra_todos_una_sola_vez(self, cantidad):
        ids = [f"t{i}" for i in range(cantidad)]
        cruces = [
            frozenset(par)
            for fecha in round_robin(ids)
            for par in fecha
        ]

        esperados = cantidad * (cantidad - 1) // 2
        assert len(cruces) == esperados
        assert len(set(cruces)) == esperados, "hay un cruce repetido"

    @pytest.mark.parametrize("cantidad", [3, 5, 7])
    def test_con_cantidad_impar_uno_queda_libre_cada_fecha(self, cantidad):
        fechas = round_robin([f"t{i}" for i in range(cantidad)])
        assert len(fechas) == cantidad
        for fecha in fechas:
            assert len(fecha) == (cantidad - 1) // 2

    def test_nadie_juega_dos_veces_en_la_misma_fecha(self):
        for fecha in round_robin([f"t{i}" for i in range(8)]):
            jugando = [equipo for par in fecha for equipo in par]
            assert len(jugando) == len(set(jugando))

    def test_la_localia_se_reparte(self):
        """
        El método del círculo deja un equipo fijo. Sin invertir la localía en las
        fechas impares, ese equipo jugaba las n-1 fechas de local.
        """
        fechas = round_robin([f"t{i}" for i in range(6)])
        de_local = sum(1 for fecha in fechas for local, _ in fecha if local == "t0")
        assert 1 <= de_local <= len(fechas) - 1

    def test_menos_de_dos_equipos_no_genera_nada(self):
        assert round_robin([]) == []
        assert round_robin(["t0"]) == []


class TestZonas:
    def test_serpentina_no_amontona_a_los_primeros(self):
        repartidos = repartir_en_zonas(equipos(8), 2)
        zonas = [t["zone"] for t in repartidos]
        assert zonas[:4] == ["A", "B", "B", "A"]

    def test_las_zonas_quedan_parejas(self):
        repartidos = repartir_en_zonas(equipos(12), 4)
        conteo = {}
        for t in repartidos:
            conteo[t["zone"]] = conteo.get(t["zone"], 0) + 1
        assert set(conteo.values()) == {3}

    def test_no_se_piden_mas_zonas_que_equipos(self):
        repartidos = repartir_en_zonas(equipos(3), 8)
        assert len({t["zone"] for t in repartidos}) == 3

    def test_fixture_de_zonas_no_cruza_zonas(self):
        repartidos = repartir_en_zonas(equipos(8), 2)
        zona_de = {t["id"]: t["zone"] for t in repartidos}
        fixtures = fixture_de_zonas(repartidos)

        assert fixtures
        for fx in fixtures:
            assert zona_de[fx["home_team_id"]] == fx["zone"]
            assert zona_de[fx["away_team_id"]] == fx["zone"]

    def test_una_zona_de_un_solo_equipo_no_genera_partidos(self):
        repartidos = repartir_en_zonas(equipos(3), 3)
        assert fixture_de_zonas(repartidos) == []


class TestLiga:
    def test_cantidad_de_partidos(self):
        fixtures = fixture_de_liga(equipos(6))
        assert len(fixtures) == 15
        assert all(fx["stage"] == "liga" for fx in fixtures)

    def test_las_fechas_arrancan_en_uno(self):
        fixtures = fixture_de_liga(equipos(4))
        assert min(fx["round"] for fx in fixtures) == 1


class TestEliminacion:
    def test_potencia_de_dos_todos_juegan_la_primera_ronda(self):
        fixtures = fixture_de_eliminacion([f"t{i}" for i in range(8)])
        primera = [fx for fx in fixtures if fx["round"] == 1]

        assert len(primera) == 4
        assert all(fx["home_team_id"] and fx["away_team_id"] for fx in primera)
        # 4 de cuartos + 2 de semis + 1 final
        assert len(fixtures) == 7

    def test_el_mejor_sembrado_juega_contra_el_ultimo(self):
        fixtures = fixture_de_eliminacion(["t0", "t1", "t2", "t3"])
        primera = sorted(
            [fx for fx in fixtures if fx["round"] == 1], key=lambda fx: fx["order"]
        )
        assert (primera[0]["home_team_id"], primera[0]["away_team_id"]) == ("t0", "t3")
        assert (primera[1]["home_team_id"], primera[1]["away_team_id"]) == ("t1", "t2")

    def test_los_mejores_pasan_de_largo_cuando_no_es_potencia_de_dos(self):
        """Con 6 equipos: los 2 primeros esperan en semis, los otros 4 juegan cuartos."""
        fixtures = fixture_de_eliminacion([f"t{i}" for i in range(6)])
        primera = [fx for fx in fixtures if fx["round"] == 1]
        segunda = [fx for fx in fixtures if fx["round"] == 2]

        assert len(primera) == 2
        jugando = {fx["home_team_id"] for fx in primera} | {fx["away_team_id"] for fx in primera}
        assert jugando == {"t2", "t3", "t4", "t5"}

        # Los sembrados que esperan ya están sentados en la ronda siguiente.
        esperando = {fx["home_team_id"] for fx in segunda} - {None}
        assert esperando == {"t0", "t1"}

    def test_nunca_se_genera_un_partido_contra_nadie(self):
        for cantidad in range(2, 17):
            fixtures = fixture_de_eliminacion([f"t{i}" for i in range(cantidad)])
            primera = [fx for fx in fixtures if fx["round"] == 1]
            for fx in primera:
                assert fx["home_team_id"] and fx["away_team_id"]

    def test_el_ganador_sabe_a_que_butaca_va(self):
        fixtures = fixture_de_eliminacion(["t0", "t1", "t2", "t3"])
        semis = [fx for fx in fixtures if fx["round"] == 1]
        indice_final = next(
            i for i, fx in enumerate(fixtures) if fx["stage"] == "final"
        )

        assert {fx["next_slot"] for fx in semis} == {"home", "away"}
        assert all(fx["next_index"] == indice_final for fx in semis)

    def test_la_ronda_inicial_se_puede_correr(self):
        """Las llaves que salen de una fase de zonas arrancan después de la última fecha."""
        fixtures = fixture_de_eliminacion(["t0", "t1", "t2", "t3"], ronda_inicial=4)
        assert min(fx["round"] for fx in fixtures) == 4


class TestTabla:
    def _fixture(self, local, visitante, gl, gv, stage="liga"):
        return {
            "stage": stage, "zone": None, "status": "jugado",
            "home_team_id": local, "away_team_id": visitante,
            "home_score": gl, "away_score": gv,
        }

    def test_puntos_y_diferencia(self):
        tabla = tabla_de_posiciones(
            equipos(3),
            [
                self._fixture("t0", "t1", 3, 0),
                self._fixture("t1", "t2", 1, 1),
                self._fixture("t0", "t2", 2, 2),
            ],
        )
        por_id = {f["team_id"]: f for f in tabla}

        assert por_id["t0"]["points"] == 4  # ganó y empató
        assert por_id["t0"]["goal_diff"] == 3
        assert por_id["t1"]["points"] == 1
        assert por_id["t2"]["points"] == 2

    def test_los_partidos_pendientes_no_cuentan(self):
        pendiente = self._fixture("t0", "t1", None, None)
        pendiente["status"] = "pendiente"
        tabla = tabla_de_posiciones(equipos(2), [pendiente])
        assert all(f["played"] == 0 for f in tabla)

    def test_las_llaves_no_suman_a_la_tabla(self):
        tabla = tabla_de_posiciones(
            equipos(2), [self._fixture("t0", "t1", 5, 0, stage="final")]
        )
        assert all(f["played"] == 0 for f in tabla)

    def test_desempata_por_diferencia_y_despues_por_goles(self):
        tabla = tabla_de_posiciones(
            equipos(4),
            [
                self._fixture("t0", "t2", 1, 0),  # t0: 3 pts, DG +1, GF 1
                self._fixture("t1", "t3", 4, 0),  # t1: 3 pts, DG +4, GF 4
            ],
        )
        assert [f["team_id"] for f in tabla[:2]] == ["t1", "t0"]

    def test_el_orden_es_estable_cuando_todo_empata(self):
        sin_jugar = tabla_de_posiciones(equipos(4), [])
        assert [f["name"] for f in sin_jugar] == sorted(f["name"] for f in sin_jugar)


class TestClasificados:
    def test_la_siembra_intercala_zonas(self):
        """Los primeros de cada zona van antes que los segundos: así 1°A no cruza 1°B."""
        teams = repartir_en_zonas(equipos(4), 2)  # t0,t3 -> A ; t1,t2 -> B
        fixtures = [
            {"stage": "zona", "zone": "A", "status": "jugado",
             "home_team_id": "t0", "away_team_id": "t3", "home_score": 3, "away_score": 0},
            {"stage": "zona", "zone": "B", "status": "jugado",
             "home_team_id": "t1", "away_team_id": "t2", "home_score": 2, "away_score": 0},
        ]
        sembrados = clasificados(teams, fixtures, qualifiers_per_zone=2)

        assert sembrados[:2] == ["t0", "t1"]   # los dos ganadores de zona
        assert set(sembrados[2:]) == {"t2", "t3"}


class TestGanador:
    def test_empate_en_una_llave_no_define(self):
        assert ganador_de({
            "status": "jugado", "home_team_id": "t0", "away_team_id": "t1",
            "home_score": 1, "away_score": 1,
        }) is None

    def test_pendiente_no_define(self):
        assert ganador_de({
            "status": "pendiente", "home_team_id": "t0", "away_team_id": "t1",
            "home_score": None, "away_score": None,
        }) is None

    def test_gana_el_que_hizo_mas(self):
        base = {"status": "jugado", "home_team_id": "t0", "away_team_id": "t1"}
        assert ganador_de({**base, "home_score": 2, "away_score": 1}) == "t0"
        assert ganador_de({**base, "home_score": 0, "away_score": 1}) == "t1"
