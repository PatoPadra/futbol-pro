"""
Tests de las cuatro correcciones deportivas del balanceador.

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

4. **Con plantel incompleto no habia arqueros.** Faltar uno es la norma, no la
   excepcion, y era el caso peor atendido: con 9 anotados en un F5 el reparto
   cae en la rama sin puestos, donde nada garantizaba que cada equipo tuviera
   arco. El unico arquero del grupo podia quedar de un lado y el otro equipo
   jugaba con el arco vacio.
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


# --------------------------------------------------------------------- #
# 4. El arquero cuando falta gente
# --------------------------------------------------------------------- #
#
# Faltar uno es la norma, no la excepcion, y era el caso peor atendido: con 9
# anotados en un F5 el balanceador cae en la rama sin puestos, y ahi no habia
# ninguna garantia de que cada equipo tuviera arquero. El unico arquero del
# grupo podia quedar de un lado y el otro equipo jugaba con el arco vacio.


def arqueros_por_equipo(resultado):
    salida = {"A": [], "B": []}
    for a in resultado["assignments"]:
        if a["position"] == "GK":
            salida[a["team"]].append(a["player_id"])
    return salida


def equipo_de(resultado, player_id):
    return next(a["team"] for a in resultado["assignments"] if a["player_id"] == player_id)


def test_cada_equipo_termina_con_un_arquero():
    """El caso central: nueve jugadores en un F5, 5 contra 4."""
    players = [jugador(f"j{i}", 5 + (i % 4)) for i in range(9)]

    res = _balance_small_format(players, "m1", 5)
    arqueros = arqueros_por_equipo(res)

    assert len(arqueros["A"]) == 1
    assert len(arqueros["B"]) == 1


def test_con_dos_arqueros_naturales_va_uno_a_cada_lado():
    """Antes podian caer los dos del mismo lado sin que nada se quejara."""
    players = [
        jugador("arq1", 6.0, "GK"),
        jugador("arq2", 6.0, "GK"),
    ] + [jugador(f"j{i}", 5 + (i % 3)) for i in range(8)]

    res = _balance_small_format(players, "m1", 5)

    assert equipo_de(res, "arq1") != equipo_de(res, "arq2")
    arqueros = arqueros_por_equipo(res)
    assert sorted(arqueros["A"] + arqueros["B"]) == ["arq1", "arq2"]


def test_con_un_solo_arquero_el_otro_equipo_designa_al_mas_flojo():
    players = [jugador("arquero", 6.0, "GK")] + [
        jugador("crack", 9.0), jugador("bueno", 8.0), jugador("normal", 7.0),
        jugador("flojo", 6.5), jugador("masflojo", 2.0),
    ]

    res = _balance_small_format(players, "m1", 5)
    arqueros = arqueros_por_equipo(res)
    equipo_del_arquero = equipo_de(res, "arquero")
    otro = "B" if equipo_del_arquero == "A" else "A"

    assert arqueros[equipo_del_arquero] == ["arquero"]
    # Del otro lado ataja alguien, y no es el mejor que tienen.
    assert len(arqueros[otro]) == 1
    designado = arqueros[otro][0]
    companeros = [
        a["player_id"] for a in res["assignments"]
        if a["team"] == otro and a["player_id"] != designado
    ]
    puntajes = {p["id"]: p["score"] for p in players}
    assert all(puntajes[designado] <= puntajes[c] for c in companeros)


def test_quien_no_quiere_atajar_no_es_designado():
    players = [
        jugador("nolequiero", 1.0, no_deseada="GK"),
        jugador("resignado", 2.0),
    ] + [jugador(f"j{i}", 6 + i) for i in range(6)]

    res = _balance_small_format(players, "m1", 5)
    designados = arqueros_por_equipo(res)
    todos = designados["A"] + designados["B"]

    assert "nolequiero" not in todos


def test_mover_un_arquero_no_rompe_el_balance_de_genero():
    """La razon por la que el arreglo es una pasada POSTERIOR y no una reserva.

    Reservar dos arqueros antes de repartir habria roto la garantia de que cada
    genero queda partido al medio, que es lo que consigue el reparto por bolsas.
    """
    players = [
        jugador("arq1", 6.0, "GK", genero="masculino"),
        jugador("arq2", 6.0, "GK", genero="masculino"),
    ] + [jugador(f"m{i}", 5 + i, genero="masculino") for i in range(4)] \
      + [jugador(f"f{i}", 5 + i, genero="femenino") for i in range(4)]

    res = _balance_small_format(players, "m1", 5)

    por_equipo = {"A": {"masculino": 0, "femenino": 0}, "B": {"masculino": 0, "femenino": 0}}
    genero_de = {p["id"]: p["gender"] for p in players}
    for a in res["assignments"]:
        por_equipo[a["team"]][genero_de[a["player_id"]]] += 1

    assert abs(por_equipo["A"]["femenino"] - por_equipo["B"]["femenino"]) <= 1
    assert abs(por_equipo["A"]["masculino"] - por_equipo["B"]["masculino"]) <= 1


def test_el_balance_se_recalcula_despues_de_mover_al_arquero():
    """Las sumas del bucle quedan viejas si hubo intercambio."""
    players = [
        jugador("arq1", 9.0, "GK"),
        jugador("arq2", 1.0, "GK"),
    ] + [jugador(f"j{i}", 5.0) for i in range(6)]

    res = _balance_small_format(players, "m1", 5)

    sumas = {"A": 0.0, "B": 0.0}
    puntajes = {p["id"]: p["score"] for p in players}
    for a in res["assignments"]:
        sumas[a["team"]] += puntajes[a["player_id"]]

    esperado = _balance_de(sumas["A"], 4, sumas["B"], 4)
    assert res["balance_score"] == pytest.approx(round(esperado, 4))


def test_un_picadito_de_dos_contra_dos_no_nombra_arquero():
    """Por debajo de tres por lado ya no es un partido con arco."""
    players = [jugador(f"j{i}", 5.0) for i in range(4)]

    res = _balance_small_format(players, "m1", 5)
    arqueros = arqueros_por_equipo(res)

    assert arqueros["A"] == []
    assert arqueros["B"] == []
