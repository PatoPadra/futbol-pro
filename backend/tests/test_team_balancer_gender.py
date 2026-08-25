"""
Tests del reparto por género en el armado de equipos.

Lo que se prueba es la promesa concreta que se le hace al organizador de un
mixto: cada género queda partido al medio entre los dos equipos, y eso no se
consigue a costa de dejar un equipo notoriamente más fuerte que el otro.

Se llama a las funciones de reparto directamente (no a `generate_teams`, que
necesita Mongo): reciben una lista de jugadores ya armada.
"""

import pytest

from team_balancer import (
    _balance_con_formacion,
    _balance_small_format,
    _bolsa_de_genero,
    _bolsas_por_genero,
    _try_formation,
)
from constants import FORMATIONS, coords_de, formaciones_de


def jugador(indice, score, gender=None, primary="ST"):
    return {
        "id": f"p{indice}",
        "name": f"Jugador {indice}",
        "photo_url": None,
        "primary_position": primary,
        "secondary_positions": [],
        "unwanted_position": None,
        "gender": gender,
        "score": float(score),
        "player_score": round(float(score), 2),
    }


def conteo_por_equipo(assignments, gender):
    return {
        equipo: sum(
            1 for a in assignments
            if a["team"] == equipo and a.get("player_gender") == gender
        )
        for equipo in ("A", "B")
    }


def suma_por_equipo(assignments, equipo):
    return sum(a["player_score"] for a in assignments if a["team"] == equipo)


class TestBolsas:
    def test_sin_declarar_y_prefiero_no_decir_van_a_la_misma_bolsa(self):
        assert _bolsa_de_genero({"gender": None}) == _bolsa_de_genero(
            {"gender": "prefiero_no_decir"}
        )

    def test_la_bolsa_mas_grande_se_reparte_primero(self):
        players = [jugador(i, 5, "femenino") for i in range(2)]
        players += [jugador(i + 10, 5, "masculino") for i in range(6)]

        bolsas = _bolsas_por_genero(players)
        assert [len(b) for b in bolsas] == [6, 2]

    def test_dentro_de_cada_bolsa_van_de_mejor_a_peor(self):
        players = [
            jugador(0, 3, "masculino"),
            jugador(1, 9, "masculino"),
            jugador(2, 6, "masculino"),
        ]
        assert [p["score"] for p in _bolsas_por_genero(players)[0]] == [9, 6, 3]


class TestReparto:
    def test_un_mixto_parejo_reparte_los_generos_al_medio(self):
        """4 mujeres y 6 varones: tienen que quedar 2 y 2, y 3 y 3."""
        players = [jugador(i, 5 + i, "femenino") for i in range(4)]
        players += [jugador(i + 10, 4 + i, "masculino") for i in range(6)]

        res = _balance_small_format(players, "m1", 5)

        assert conteo_por_equipo(res["assignments"], "femenino") == {"A": 2, "B": 2}
        assert conteo_por_equipo(res["assignments"], "masculino") == {"A": 3, "B": 3}

    def test_las_mejores_jugadoras_no_caen_todas_del_mismo_lado(self):
        """
        El caso que motivó todo esto: si las jugadoras se reparten pero las dos
        mejores van juntas, el mixto sigue estando desequilibrado.
        """
        players = [
            jugador(0, 9, "femenino"), jugador(1, 8.5, "femenino"),
            jugador(2, 3, "femenino"), jugador(3, 2.5, "femenino"),
        ]
        players += [jugador(i + 10, 5, "masculino") for i in range(6)]

        res = _balance_small_format(players, "m1", 5)
        mejores = {
            a["team"] for a in res["assignments"] if a["player_id"] in ("p0", "p1")
        }
        assert mejores == {"A", "B"}

    def test_con_un_genero_impar_la_diferencia_es_de_uno(self):
        players = [jugador(i, 5, "femenino") for i in range(3)]
        players += [jugador(i + 10, 5, "masculino") for i in range(7)]

        res = _balance_small_format(players, "m1", 5)
        for genero in ("femenino", "masculino"):
            conteo = conteo_por_equipo(res["assignments"], genero)
            assert abs(conteo["A"] - conteo["B"]) <= 1

    def test_los_equipos_no_quedan_de_tamanios_distintos(self):
        players = [jugador(i, 5, "femenino") for i in range(3)]
        players += [jugador(i + 10, 5, "masculino") for i in range(5)]
        players += [jugador(i + 20, 5, "otro") for i in range(3)]

        res = _balance_small_format(players, "m1", 5)
        cuenta = {
            equipo: sum(1 for a in res["assignments"] if a["team"] == equipo)
            for equipo in ("A", "B")
        }
        assert abs(cuenta["A"] - cuenta["B"]) <= 1

    def test_el_puntaje_sigue_quedando_parejo(self):
        """Repartir por género no puede costar el balance de nivel."""
        players = [jugador(i, 3 + i, "femenino") for i in range(6)]
        players += [jugador(i + 10, 2 + i * 1.5, "masculino") for i in range(6)]

        res = _balance_small_format(players, "m1", 6)
        sumas = [suma_por_equipo(res["assignments"], e) for e in ("A", "B")]

        assert res["balance_score"] > 0.9
        assert abs(sumas[0] - sumas[1]) < 4

    def test_sin_generos_cargados_se_comporta_como_antes(self):
        """Nadie declaró nada: una sola bolsa, y el reparto sigue siendo por nivel."""
        players = [jugador(i, 10 - i) for i in range(10)]
        res = _balance_small_format(players, "m1", 5)

        assert res["balance_score"] > 0.95
        assert conteo_por_equipo(res["assignments"], None) == {"A": 5, "B": 5}

    def test_el_reparto_es_determinista(self):
        players = [jugador(i, 5 + (i % 4), "femenino" if i % 3 == 0 else "masculino")
                   for i in range(12)]

        primero = _balance_small_format(list(players), "m1", 6)
        segundo = _balance_small_format(list(players), "m1", 6)

        assert primero["assignments"] == segundo["assignments"]

    def test_el_gender_split_cuenta_lo_que_realmente_paso(self):
        players = [jugador(i, 5, "femenino") for i in range(4)]
        players += [jugador(i + 10, 5, "masculino") for i in range(4)]

        res = _balance_small_format(players, "m1", 4)
        assert res["gender_split"]["femenino"] == {"A": 2, "B": 2}
        assert res["gender_split"]["masculino"] == {"A": 2, "B": 2}


class TestOnceContraOnce:
    def test_la_formacion_tambien_reparte_los_generos(self):
        """
        En 11v11 el reparto lo manda el puesto, no la bolsa: el género entra como
        un término del costo. Con 22 jugadores del mismo nivel no hay nada que
        el puntaje prefiera, así que el género tiene que quedar partido al medio.
        """
        players = [jugador(i, 5, "femenino" if i < 8 else "masculino") for i in range(22)]

        res = _try_formation(players, FORMATIONS["4-4-2"], "4-4-2", "m1")
        conteo = conteo_por_equipo(res["assignments"], "femenino")

        assert abs(conteo["A"] - conteo["B"]) <= 1

    def test_no_arruina_el_balance_de_nivel(self):
        players = [
            jugador(i, 2 + (i % 9), "femenino" if i % 4 == 0 else "masculino")
            for i in range(22)
        ]
        res = _try_formation(players, FORMATIONS["4-3-3"], "4-3-3", "m1")
        assert res["balance_score"] > 0.9

    def test_cada_asignacion_lleva_el_genero(self):
        players = [jugador(i, 5, "masculino") for i in range(22)]
        res = _try_formation(players, FORMATIONS["4-4-2"], "4-4-2", "m1")
        assert all("player_gender" in a for a in res["assignments"])


class TestFormacionesDeFormatoChico:
    """
    Los formatos que no son 11 también se arman por formación.

    Antes el balanceador miraba `if modality == 11` y todo lo demás caía en el
    reparto sin puestos: por eso un F5 o un F7 no tenían cancha para dibujar.
    """

    @pytest.mark.parametrize("modalidad", [5, 6, 7, 8, 9, 10, 11])
    def test_con_el_plantel_completo_sale_una_formacion(self, modalidad):
        players = [jugador(i, 5 + (i % 5)) for i in range(modalidad * 2)]
        formaciones = formaciones_de(modalidad)

        res = _balance_con_formacion(players, "m1", formaciones)

        assert res["formation_a"] in formaciones
        assert len(res["assignments"]) == modalidad * 2

    @pytest.mark.parametrize("modalidad", [5, 6, 7, 8, 9, 10])
    def test_cada_equipo_tiene_un_arquero_y_nada_mas(self, modalidad):
        players = [jugador(i, 5, primary="GK" if i < 2 else "ST") for i in range(modalidad * 2)]
        res = _balance_con_formacion(players, "m1", formaciones_de(modalidad))

        for equipo in ("A", "B"):
            arqueros = [
                a for a in res["assignments"]
                if a["team"] == equipo and a["position"] == "GK"
            ]
            assert len(arqueros) == 1, f"{modalidad}: equipo {equipo} tiene {len(arqueros)}"

    @pytest.mark.parametrize("modalidad", [5, 6, 7, 8, 9, 10])
    def test_los_puestos_coinciden_con_las_coordenadas_de_la_cancha(self, modalidad):
        """Si no coinciden, la cancha dibuja huecos o se come jugadores."""
        players = [jugador(i, 5) for i in range(modalidad * 2)]
        res = _balance_con_formacion(players, "m1", formaciones_de(modalidad))

        coords = coords_de(modalidad, res["formation_a"])
        for equipo in ("A", "B"):
            puestos = sorted(
                a["position"] for a in res["assignments"] if a["team"] == equipo
            )
            assert puestos == sorted(c["pos"] for c in coords)

    @pytest.mark.parametrize("modalidad", [5, 7, 9])
    def test_el_genero_se_sigue_repartiendo(self, modalidad):
        """La formación no puede pisar el reparto de los mixtos."""
        total = modalidad * 2
        players = [
            jugador(i, 5, "femenino" if i < total // 2 else "masculino")
            for i in range(total)
        ]
        res = _balance_con_formacion(players, "m1", formaciones_de(modalidad))

        conteo = conteo_por_equipo(res["assignments"], "femenino")
        assert abs(conteo["A"] - conteo["B"]) <= 1

    def test_sin_gente_suficiente_se_reparte_sin_puestos(self):
        """Faltan jugadores para llenar la formación: equipos igual, cancha no."""
        players = [jugador(i, 5) for i in range(8)]  # un F5 necesita 10
        res = _balance_small_format(players, "m1", 5)

        assert res["formation_a"] is None
        assert len(res["assignments"]) == 8

    def test_toda_modalidad_aceptada_tiene_formaciones(self):
        """Si MODALITY_CAPACITY acepta una modalidad, tiene que poder dibujarse."""
        from constants import MODALITY_CAPACITY

        sin_formacion = [m for m in MODALITY_CAPACITY if not formaciones_de(m)]
        assert sin_formacion == []
