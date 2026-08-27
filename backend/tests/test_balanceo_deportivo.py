"""
Tests de las tres correcciones deportivas del balanceador.

1. **Al arco va el que menos juega.** `GK` es el primer puesto de toda
   formación y el desempate entre candidatos del mismo fit era por puntaje
   descendente, así que con un solo arquero natural el segundo arco se lo
   llevaba el mejor defensor del grupo. Sin ningún arquero, iban los dos mejores
   centrales. Es la escena que rompe el partido del sábado: nadie quiere atajar
   y el sistema le encajaba el arco justo al que mejor juega.

2. **El medidor de balance decía la verdad a medias.** `1 - |sumA - sumB| / total`
   está diluido por el tamaño del equipo: el mismo desbalance real daba un
   número más generoso cuanta más gente hubiera. Ahora mide la brecha de
   promedios, que es la misma en cualquier modalidad.

3. **El spread.** Un 97% de balance sobre un plantel donde todos valen lo mismo
   no es un buen reparto: es una cuenta hecha sobre nada. Ahora viaja el dato
   para que la pantalla pueda decirlo.
"""

import pytest

from team_balancer import (
    BRECHA_MAXIMA,
    SPREAD_MINIMO_CONFIABLE,
    _balance_de,
    _balance_small_format,
    _spread_de,
    _try_formation,
)


def jugador(nombre, score, primary=None, *, secundarias=None, no_deseada=None, genero=None):
    return {
        "id": nombre,
        "name": nombre,
        "score": score,
        "player_score": round(score, 2),
        "primary_position": primary,
        "secondary_positions": secundarias or [],
        "unwanted_position": no_deseada,
        "gender": genero,
    }


def puesto_de(resultado, position):
    return sorted(
        a["player_id"] for a in resultado["assignments"] if a["position"] == position
    )


# --------------------------------------------------------------------- #
# 1. El arquero
# --------------------------------------------------------------------- #

def test_con_un_solo_arquero_el_otro_arco_va_al_defensor_mas_flojo():
    """Antes se lo llevaba el defensor de MÁS puntaje del grupo."""
    players = [
        jugador("arquero", 5.0, "GK"),
        jugador("crack", 9.0, "CB"),
        jugador("bueno", 8.0, "CB"),
        jugador("flojo", 4.0, "CB"),
        jugador("punta1", 7.0, "ST"),
        jugador("punta2", 6.0, "ST"),
    ]

    res = _try_formation(players, ["GK", "CB", "ST"], "1-1-1", "m1")

    assert puesto_de(res, "GK") == ["arquero", "flojo"]
    # Y el crack se quedó en la cancha, que es todo el punto.
    assert "crack" not in puesto_de(res, "GK")


def test_sin_ningun_arquero_van_los_dos_mas_flojos_de_la_zona():
    players = [
        jugador("crack", 9.0, "CB"),
        jugador("bueno", 8.0, "CB"),
        jugador("flojo", 4.0, "CB"),
        jugador("masflojo", 3.0, "CB"),
        jugador("punta1", 7.0, "ST"),
        jugador("punta2", 6.0, "ST"),
    ]

    res = _try_formation(players, ["GK", "CB", "ST"], "1-1-1", "m1")

    assert puesto_de(res, "GK") == ["flojo", "masflojo"]


def test_el_arquero_de_verdad_le_gana_a_cualquier_defensor_flojo():
    """El fit sigue mandando: esto no es "que ataje el peor" a secas."""
    players = [
        jugador("arquero", 9.5, "GK"),
        jugador("otroarquero", 9.0, "GK"),
        jugador("nulo", 1.0, "CB"),
        jugador("flojito", 2.0, "CB"),
        jugador("punta1", 7.0, "ST"),
        jugador("punta2", 6.0, "ST"),
    ]

    res = _try_formation(players, ["GK", "CB", "ST"], "1-1-1", "m1")

    assert puesto_de(res, "GK") == ["arquero", "otroarquero"]


def test_quien_no_quiere_atajar_no_ataja_aunque_sea_el_mas_flojo():
    """`unwanted_position` da fit 0.05: queda por debajo de todos."""
    players = [
        jugador("arquero", 6.0, "GK"),
        jugador("nolequiero", 2.0, "CB", no_deseada="GK"),
        jugador("resignado", 4.0, "CB"),
        jugador("crack", 9.0, "CB"),
        jugador("punta1", 7.0, "ST"),
        jugador("punta2", 6.0, "ST"),
    ]

    res = _try_formation(players, ["GK", "CB", "ST"], "1-1-1", "m1")

    assert "nolequiero" not in puesto_de(res, "GK")
    assert puesto_de(res, "GK") == ["arquero", "resignado"]


def test_los_demas_puestos_siguen_prefiriendo_al_mejor():
    """La inversión es SÓLO para el arco."""
    players = [
        jugador("arquero", 5.0, "GK"),
        jugador("arquero2", 5.0, "GK"),
        jugador("crack", 9.0, "ST"),
        jugador("bueno", 8.0, "ST"),
        jugador("flojo", 2.0, "ST"),
        jugador("masflojo", 1.0, "ST"),
    ]

    res = _try_formation(players, ["GK", "ST"], "1-1", "m1")

    assert puesto_de(res, "ST") == ["bueno", "crack"]


# --------------------------------------------------------------------- #
# 2. El medidor de balance
# --------------------------------------------------------------------- #

def test_el_mismo_desbalance_da_lo_mismo_en_cualquier_modalidad():
    """El corazón del bug: la fórmula vieja dependía del tamaño del equipo.

    Un punto de diferencia por jugador es el mismo problema deportivo se juegue
    de a cinco o de a once. La fórmula vieja daba 0.909 en 11v11 ("muy parejo")
    y 0.833 en 5v5, por el sólo hecho de que hubiera más gente.
    """
    once = _balance_de(sum_a=66.0, count_a=11, sum_b=55.0, count_b=11)
    cinco = _balance_de(sum_a=30.0, count_a=5, sum_b=25.0, count_b=5)

    assert once == pytest.approx(cinco)
    assert once == pytest.approx(1 - 1.0 / BRECHA_MAXIMA)


def test_un_punto_de_diferencia_por_jugador_ya_no_dice_muy_parejo():
    """0.667 no llega al umbral de "muy parejo" (0.90) ni al de "aceptable" (0.75)."""
    assert _balance_de(66.0, 11, 55.0, 11) == pytest.approx(0.667, abs=0.001)


def test_equipos_identicos_dan_uno():
    assert _balance_de(50.0, 10, 50.0, 10) == 1.0


def test_una_brecha_enorme_no_se_va_a_negativo():
    """Sin el `max(0, ...)` una diferencia de más de 3 puntos daba negativo."""
    assert _balance_de(100.0, 10, 10.0, 10) == 0.0


def test_un_equipo_vacio_no_divide_por_cero():
    assert _balance_de(50.0, 10, 0.0, 0) == 1.0


def test_el_reparto_chico_usa_la_formula_nueva():
    players = [jugador(f"j{i}", 10 - i) for i in range(10)]
    res = _balance_small_format(players, "m1", 5)

    # 27 contra 28 en equipos de cinco: 0.2 de brecha de promedio.
    assert res["balance_score"] == pytest.approx(1 - 0.2 / BRECHA_MAXIMA, abs=0.001)


# --------------------------------------------------------------------- #
# 3. El spread
# --------------------------------------------------------------------- #

def test_el_spread_viaja_con_la_generacion():
    players = [jugador(f"j{i}", 10 - i) for i in range(10)]
    res = _balance_small_format(players, "m1", 5)

    assert res["score_spread"] == pytest.approx(9.0)


def test_un_grupo_nuevo_tiene_spread_casi_cero():
    """El caso que hace mentir al medidor.

    Con el prior neutro y el piso de confianza, en un grupo sin historia todos
    los jugadores quedan aplastados alrededor de 5.9. El balance da altísimo
    porque los equipos son igual de desconocidos, no porque estén bien armados.
    """
    players = [jugador(f"j{i}", 5.90 + (i % 2) * 0.05) for i in range(10)]
    res = _balance_small_format(players, "m1", 5)

    assert res["score_spread"] < SPREAD_MINIMO_CONFIABLE
    assert res["balance_score"] > 0.98  # el número miente, y por eso se avisa


def test_un_solo_jugador_no_tiene_spread():
    assert _spread_de([jugador("solo", 7.0)]) == 0.0
    assert _spread_de([]) == 0.0
