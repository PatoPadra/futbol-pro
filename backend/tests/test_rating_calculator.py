"""Tests unitarios de las funciones puras de rating_calculator.

No tocan Mongo ni mockean motor: son todas funciones sincronicas y puras.
"""

from datetime import datetime, timedelta, timezone

import pytest

from rating_calculator import (
    NEUTRAL_PRIOR,
    _calculate_stats_bonus,
    _recency_weighted_average,
    _weighted_average,
    compute_final_score,
)


# --- compute_final_score ---------------------------------------------------


def test_jugador_nuevo_bueno_no_queda_debajo_de_mediocre_consolidado():
    """EL test del bug: la formula vieja (rating * confianza) daba 2.4 vs 5.0
    y mandaba a los invitados al fondo del snake draft."""
    nuevo_bueno = compute_final_score(
        recent_rating=8.0, effective_confidence=0.3, stats_bonus=0.0
    )
    mediocre_consolidado = compute_final_score(
        recent_rating=5.0, effective_confidence=1.0, stats_bonus=0.0
    )

    assert nuevo_bueno > mediocre_consolidado, (
        f"un jugador nuevo bueno ({nuevo_bueno}) tiene que rankear por encima "
        f"de un mediocre consolidado ({mediocre_consolidado})"
    )
    # 8.0 * 0.3 + 5.0 * 0.7 = 2.4 + 3.5
    assert nuevo_bueno == pytest.approx(5.9)


def test_confianza_total_devuelve_rating_puro_mas_bonus():
    assert compute_final_score(7.4, 1.0, 0.0) == pytest.approx(7.4)
    assert compute_final_score(7.4, 1.0, 0.6) == pytest.approx(8.0)


def test_confianza_cero_devuelve_prior_neutro_mas_bonus():
    assert compute_final_score(9.5, 0.0, 0.0) == pytest.approx(NEUTRAL_PRIOR)
    assert compute_final_score(1.0, 0.0, 0.0) == pytest.approx(NEUTRAL_PRIOR)
    assert compute_final_score(9.5, 0.0, 0.4) == pytest.approx(NEUTRAL_PRIOR + 0.4)


def test_el_prior_neutro_es_el_nivel_por_defecto_del_proyecto():
    assert NEUTRAL_PRIOR == 5.0


def test_shrinkage_es_monotono_en_la_confianza():
    """A mas confianza, mas se acerca al rating real y menos al prior."""
    scores = [
        compute_final_score(9.0, conf, 0.0)
        for conf in (0.0, 0.25, 0.5, 0.75, 1.0)
    ]
    assert scores == sorted(scores)
    assert scores[0] == pytest.approx(5.0)
    assert scores[-1] == pytest.approx(9.0)


def test_shrinkage_sube_al_jugador_flojo_sin_historial():
    """Simetrico: un jugador malo con poca evidencia tambien tira al medio."""
    flojo_nuevo = compute_final_score(2.0, 0.3, 0.0)
    assert 2.0 < flojo_nuevo < NEUTRAL_PRIOR
    assert flojo_nuevo == pytest.approx(4.1)


# --- _weighted_average -----------------------------------------------------


def test_weighted_average_promedio_ponderado_correcto():
    ratings = [
        {"score": 10.0, "weight": 1.0},
        {"score": 5.0, "weight": 0.6},
    ]
    # (10 * 1 + 5 * 0.6) / 1.6 = 13 / 1.6
    assert _weighted_average(ratings) == pytest.approx(8.125)


def test_weighted_average_pesos_iguales():
    ratings = [{"score": 8.0, "weight": 1.0}, {"score": 4.0, "weight": 1.0}]
    assert _weighted_average(ratings) == pytest.approx(6.0)


def test_weighted_average_ignora_scores_none():
    ratings = [
        {"score": 8.0, "weight": 1.0},
        {"score": None, "weight": 1.0},
        {"score": 4.0, "weight": 1.0},
    ]
    assert _weighted_average(ratings) == pytest.approx(6.0)


def test_weighted_average_lista_vacia_devuelve_neutro():
    assert _weighted_average([]) == pytest.approx(NEUTRAL_PRIOR)


def test_weighted_average_sin_peso_acumulado_devuelve_neutro():
    """Todos los scores en None => weight_total 0, no puede dividir."""
    ratings = [{"score": None, "weight": 1.0}, {"score": None, "weight": 0.6}]
    assert _weighted_average(ratings) == pytest.approx(NEUTRAL_PRIOR)


# --- _recency_weighted_average ---------------------------------------------


def _rating(score: float, days_ago: int) -> dict:
    created = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return {"score": score, "created_at": created.isoformat()}


def test_recency_una_calificacion_reciente_pesa_mas_que_una_vieja():
    now = datetime.now(timezone.utc)
    ratings = [_rating(9.0, days_ago=1), _rating(3.0, days_ago=300)]

    resultado = _recency_weighted_average(ratings, now)

    promedio_simple = 6.0
    assert resultado > promedio_simple
    assert 3.0 < resultado < 9.0


def test_recency_invertir_las_fechas_invierte_el_resultado():
    now = datetime.now(timezone.utc)
    reciente_alto = _recency_weighted_average(
        [_rating(9.0, days_ago=1), _rating(3.0, days_ago=300)], now
    )
    reciente_bajo = _recency_weighted_average(
        [_rating(9.0, days_ago=300), _rating(3.0, days_ago=1)], now
    )
    assert reciente_alto > reciente_bajo


def test_recency_created_at_faltante_o_invalido_no_explota():
    now = datetime.now(timezone.utc)
    ratings = [
        {"score": 7.0},  # sin created_at
        {"score": 7.0, "created_at": "no-es-una-fecha"},
        {"score": 7.0, "created_at": None},
        {"score": 7.0, "created_at": ""},
    ]

    resultado = _recency_weighted_average(ratings, now)

    assert resultado == pytest.approx(7.0)


def test_recency_created_at_con_zulu_se_parsea():
    now = datetime.now(timezone.utc)
    created = (now - timedelta(days=2)).replace(tzinfo=None).isoformat() + "Z"
    resultado = _recency_weighted_average([{"score": 6.5, "created_at": created}], now)
    assert resultado == pytest.approx(6.5)


def test_recency_lista_vacia_devuelve_neutro():
    assert _recency_weighted_average([], datetime.now(timezone.utc)) == pytest.approx(
        NEUTRAL_PRIOR
    )


# --- _calculate_stats_bonus ------------------------------------------------


def test_stats_bonus_lista_vacia_da_cero():
    assert _calculate_stats_bonus([]) == 0.0


def test_stats_bonus_calculo_por_partido():
    stats = [{"goals": 2, "assists": 1, "saves": 0}]
    # 2 * 0.3 + 1 * 0.2 + 0 * 0.15 = 0.8
    assert _calculate_stats_bonus(stats) == pytest.approx(0.8)


def test_stats_bonus_promedia_entre_partidos():
    stats = [
        {"goals": 2, "assists": 0, "saves": 0},
        {"goals": 0, "assists": 0, "saves": 0},
    ]
    # 1 gol por partido * 0.3
    assert _calculate_stats_bonus(stats) == pytest.approx(0.3)


def test_stats_bonus_campos_faltantes_valen_cero():
    assert _calculate_stats_bonus([{"goals": 1}]) == pytest.approx(0.3)


def test_stats_bonus_topeado_en_uno():
    stats = [{"goals": 10, "assists": 10, "saves": 10}]
    assert _calculate_stats_bonus(stats) == 1.0


# --- el denominador del bonus ----------------------------------------------
#
# Antes se dividía por la cantidad de FILAS de estadísticas, y un jugador sin
# nada que anotar no genera fila. O sea que el bonus premiaba al que tenía el
# historial incompleto: el goleador del grupo pasaba a ser el que tenía mejor
# prensa.


def test_el_bonus_se_divide_por_partidos_jugados_y_no_por_filas():
    """El ejemplo exacto de la auditoría, con sus números.

    Dos jugadores con diez partidos recientes cada uno. Al primero le cargaron
    sólo sus dos mejores (3 goles en cada uno); al segundo, los diez (10 goles
    en total, o sea que convirtió MÁS). Con el denominador viejo el primero
    sacaba 0.90 y el segundo 0.30: tres veces más bonus por menos goles.
    """
    con_prensa = [{"match_id": f"m{i}", "goals": 3} for i in range(2)]
    goleador = [{"match_id": f"m{i}", "goals": 1} for i in range(10)]

    bonus_con_prensa = _calculate_stats_bonus(con_prensa, partidos_recientes=10)
    bonus_goleador = _calculate_stats_bonus(goleador, partidos_recientes=10)

    assert bonus_con_prensa == pytest.approx(0.18)   # 6 goles / 10 partidos * 0.3
    assert bonus_goleador == pytest.approx(0.30)     # 10 goles / 10 partidos * 0.3
    assert bonus_goleador > bonus_con_prensa


def test_sin_el_dato_de_partidos_se_comporta_como_antes():
    """Compatibilidad: el argumento es opcional y el default no rompe nada."""
    stats = [{"match_id": "m1", "goals": 2}, {"match_id": "m2", "goals": 4}]
    assert _calculate_stats_bonus(stats) == pytest.approx(0.9)


def test_nunca_divide_por_menos_filas_de_las_que_hay():
    """Red: si llegaran más filas que partidos, no inflamos dividiendo por menos."""
    stats = [{"match_id": f"m{i}", "goals": 1} for i in range(4)]
    assert _calculate_stats_bonus(stats, partidos_recientes=1) == pytest.approx(0.3)


def test_el_arquero_puede_sumar_bonus_por_atajadas():
    """`saves` pesa 0.15 y ahora viene prendida por default en modo Pro."""
    stats = [{"match_id": "m1", "saves": 4}]
    assert _calculate_stats_bonus(stats, partidos_recientes=1) == pytest.approx(0.6)
