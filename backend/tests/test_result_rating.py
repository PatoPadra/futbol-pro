"""
Tests de la fase 3: el resultado mueve el puntaje, y las notas del organizador.

Esta es la parte de la app donde un error no se ve. Un bug en el armado de
equipos se nota el sábado; un bug acá deja a un jugador con medio punto de más
durante seis meses y nadie se entera nunca. Por eso los tests van sobre el
comportamiento que importa y no sobre los números exactos: que ganarle a un
equipo más fuerte valga más que ganarle a uno más débil, que un solo partido no
mueva medio puntaje, que una racha corta no alcance para decir que alguien no
rinde en los oficiales.

El fixture `mongo_en_memoria` viene de conftest.py y parchea `db` en todo el
backend, así que un service nuevo queda cubierto sin tocar nada.
"""

from datetime import datetime, timedelta, timezone
import uuid

import pytest
from fastapi import HTTPException

import database
import rating_calculator
import routes_matches as rm
import routes_notes as rn
import routes_post_match as rpm
import routes_teams as rt
from constants import SPLIT_MIN_MATCHES, probabilidad_esperada, puntaje_por_resultado
from models import (
    CreateMatchRequest,
    PlayerNoteRequest,
    SetAttendanceRequest,
    SetMatchResultRequest,
)
from services import match_outcomes as svc_outcomes


AHORA = datetime.now(timezone.utc)


async def sembrar_jugador(db, nombre="Jugador", role="organizador"):
    user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    await db.player_profiles.insert_one({
        "id": profile_id,
        "user_id": user_id,
        "name": nombre,
        "player_type": "frecuente",
        "matches_played": 0,
        "created_at": AHORA.isoformat(),
    })
    return {"user_id": user_id, "role": role}, profile_id


async def sembrar_grupo(db, profile_id):
    group_id = str(uuid.uuid4())
    await db.groups.insert_one({
        "id": group_id,
        "name": "Los del martes",
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


async def armar_partido_con_equipos(
    db,
    *,
    mode="avanzado",
    match_type="oficial",
    fuerza_a=5.0,
    fuerza_b=5.0,
    por_equipo=2,
    fecha=None,
):
    """Un partido finalizado con equipos ya generados y puntajes congelados.

    Devuelve (user, match_id, ids_a, ids_b).
    """
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await rm.create_match(
        CreateMatchRequest(
            group_id=group_id,
            title="Partido",
            modality=5,
            date=fecha or AHORA.strftime("%Y-%m-%d"),
            time="20:00",
            location="La cancha",
            mode=mode,
            match_type=match_type,
        ),
        user=user,
    )

    asignaciones = []
    ids = {"A": [], "B": []}
    orden = 1
    for equipo, fuerza in (("A", fuerza_a), ("B", fuerza_b)):
        for i in range(por_equipo):
            nombre = f"{equipo}{i}"
            if equipo == "A" and i == 0:
                player_id = organizador
            else:
                _, player_id = await sembrar_jugador(db, nombre)
            await db.match_registrations.insert_one({
                "id": str(uuid.uuid4()),
                "match_id": partido.id,
                "player_id": player_id,
                "status": "titular",
                "order": orden,
                "registered_at": AHORA.isoformat(),
            })
            asignaciones.append({
                "player_id": player_id,
                "player_name": nombre,
                "team": equipo,
                "position": "JUG",
                "player_score": fuerza,
            })
            ids[equipo].append(player_id)
            orden += 1

    await db.team_generations.insert_one({
        "id": str(uuid.uuid4()),
        "match_id": partido.id,
        "status": "confirmado",
        "assignments": asignaciones,
        "balance_score": 1.0,
        "created_at": AHORA.isoformat(),
    })
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "finalizado"}})

    return user, partido.id, ids["A"], ids["B"]


async def cargar_resultado(match_id, user, local, visitante):
    return await rpm.set_match_result(
        match_id, SetMatchResultRequest(home_score=local, away_score=visitante), user=user
    )


async def outcome_de(db, match_id, player_id):
    return await db.match_outcomes.find_one(
        {"match_id": match_id, "player_id": player_id}, {"_id": 0}
    )


# ---------------------------------------------------------------------------
# La matemática, suelta
# ---------------------------------------------------------------------------

def test_ganar_siendo_favorito_vale_menos_que_ganar_de_visitante_moral():
    """Es la idea entera del canal: la sorpresa es lo que informa."""
    favorito = puntaje_por_resultado(probabilidad_esperada(8, 4), 1.0, 1)
    tapado = puntaje_por_resultado(probabilidad_esperada(4, 8), 1.0, 1)
    assert tapado > favorito
    # Y ganarle al que tenías que ganarle casi no mueve la aguja.
    assert favorito < 6.0


def test_un_partido_que_sale_como_se_esperaba_no_dice_nada():
    """Sin sorpresa el puntaje queda en el prior neutro, o sea que no aporta."""
    assert puntaje_por_resultado(0.5, 0.5, 0) == 5.0


def test_una_goleada_no_vale_diez_veces_un_uno_a_cero():
    ajustado = puntaje_por_resultado(0.5, 1.0, 1)
    goleada = puntaje_por_resultado(0.5, 1.0, 10)
    assert goleada > ajustado
    # Menos del 40% más, no diez veces: en amateur una goleada suele querer decir
    # que faltaron dos y jugaron nueve contra once.
    assert goleada < ajustado * 1.4


def test_empatarle_a_un_equipo_mas_fuerte_suma():
    assert puntaje_por_resultado(probabilidad_esperada(4, 8), 0.5, 0) > 5.0


# ---------------------------------------------------------------------------
# De resultado a filas
# ---------------------------------------------------------------------------

async def test_cargar_el_resultado_le_pone_puntaje_a_los_dos_equipos(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id, equipo_a, equipo_b = await armar_partido_con_equipos(db)

    res = await cargar_resultado(match_id, user, 3, 1)

    assert res["rated_players"] == 4
    ganador = await outcome_de(db, match_id, equipo_a[0])
    perdedor = await outcome_de(db, match_id, equipo_b[0])
    assert ganador["score"] > 5.0
    assert perdedor["score"] < 5.0
    assert ganador["actual"] == 1.0
    assert perdedor["goal_diff"] == -2


async def test_el_empate_deja_a_todos_en_el_medio_si_estaban_parejos(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id, equipo_a, _ = await armar_partido_con_equipos(db)

    await cargar_resultado(match_id, user, 2, 2)

    fila = await outcome_de(db, match_id, equipo_a[0])
    assert fila["score"] == 5.0


async def test_corregir_el_resultado_rehace_las_filas(mongo_en_memoria):
    """Idempotente por construcción: borra y vuelve a escribir."""
    db = mongo_en_memoria
    user, match_id, equipo_a, _ = await armar_partido_con_equipos(db)

    await cargar_resultado(match_id, user, 3, 0)
    assert (await outcome_de(db, match_id, equipo_a[0]))["score"] > 5.0

    await cargar_resultado(match_id, user, 0, 3)

    assert await db.match_outcomes.count_documents({"match_id": match_id}) == 4
    assert (await outcome_de(db, match_id, equipo_a[0]))["score"] < 5.0


async def test_el_que_no_vino_no_cobra_el_resultado(mongo_en_memoria):
    """El que plantó el sábado no se lleva la victoria."""
    db = mongo_en_memoria
    user, match_id, equipo_a, _ = await armar_partido_con_equipos(db)

    await rpm.set_attendance(
        match_id,
        SetAttendanceRequest(entries=[{"player_id": equipo_a[1], "attendance": "sin_aviso"}]),
        user=user,
    )
    await cargar_resultado(match_id, user, 3, 0)

    assert await outcome_de(db, match_id, equipo_a[0]) is not None
    assert await outcome_de(db, match_id, equipo_a[1]) is None


async def test_marcar_una_ausencia_despues_saca_la_fila(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id, equipo_a, _ = await armar_partido_con_equipos(db)
    await cargar_resultado(match_id, user, 3, 0)
    assert await outcome_de(db, match_id, equipo_a[1]) is not None

    await rpm.set_attendance(
        match_id,
        SetAttendanceRequest(entries=[{"player_id": equipo_a[1], "attendance": "ausente"}]),
        user=user,
    )

    assert await outcome_de(db, match_id, equipo_a[1]) is None


async def test_en_diversion_el_resultado_no_le_pone_nota_a_nadie(mongo_en_memoria):
    """Que la app anote quién ganó no significa que califique a los jugadores."""
    db = mongo_en_memoria
    user, match_id, _, _ = await armar_partido_con_equipos(db, mode="diversion")

    await cargar_resultado(match_id, user, 4, 0)

    assert await db.match_outcomes.count_documents({"match_id": match_id}) == 0


async def test_sin_equipos_no_hay_contra_quien_comparar(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id, _, _ = await armar_partido_con_equipos(db)
    await db.team_generations.delete_many({"match_id": match_id})

    await cargar_resultado(match_id, user, 2, 1)

    assert await db.match_outcomes.count_documents({"match_id": match_id}) == 0


async def test_se_guarda_lo_que_el_balanceador_habia_predicho(mongo_en_memoria):
    """Es la única forma de enterarse de que dijo 'parejo' y salió 6 a 0."""
    db = mongo_en_memoria
    user, match_id, _, _ = await armar_partido_con_equipos(db, fuerza_a=8.0, fuerza_b=4.0)

    await cargar_resultado(match_id, user, 0, 3)

    partido = await db.matches.find_one({"id": match_id}, {"_id": 0})
    assert partido["result"]["expected_home"] > 0.7


async def test_borrar_el_partido_se_lleva_las_filas(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id, _, _ = await armar_partido_con_equipos(db)
    await cargar_resultado(match_id, user, 1, 0)
    admin = {"user_id": user["user_id"], "role": "admin"}

    await rm.delete_match(match_id, user=admin)

    assert await db.match_outcomes.count_documents({"match_id": match_id}) == 0


# ---------------------------------------------------------------------------
# De filas a puntaje
# ---------------------------------------------------------------------------

async def sembrar_outcomes(db, player_id, cantidad, score, match_type="oficial", dias_atras=1):
    for i in range(cantidad):
        cuando = (AHORA - timedelta(days=dias_atras)).isoformat()
        await db.match_outcomes.insert_one({
            "id": str(uuid.uuid4()),
            "match_id": str(uuid.uuid4()),
            "player_id": player_id,
            "team": "A",
            "score": score,
            "expected": 0.5,
            "actual": 1.0 if score > 5 else 0.0,
            "goal_diff": 1,
            "match_type": match_type,
            "created_at": cuando,
        })


async def test_sin_resultados_el_rating_es_el_de_siempre(mongo_en_memoria):
    """Nada de lo que ya estaba cambia de valor porque exista el canal nuevo."""
    db = mongo_en_memoria
    _, jugador = await sembrar_jugador(db)
    await db.group_seed_ratings.insert_one({
        "id": str(uuid.uuid4()),
        "group_id": "g",
        "rater_id": "otro",
        "rated_player_id": jugador,
        "score": 8,
        "created_at": AHORA.isoformat(),
    })

    metricas = await rating_calculator.calculate_player_metrics(jugador)

    assert metricas["general_rating"] == 8.0
    assert metricas["result_matches"] == 0


async def test_un_solo_resultado_mueve_poco(mongo_en_memoria):
    """Una goleada suelta no puede arruinarle el puntaje a nadie."""
    db = mongo_en_memoria
    _, jugador = await sembrar_jugador(db)
    await db.group_seed_ratings.insert_one({
        "id": str(uuid.uuid4()), "group_id": "g", "rater_id": "otro",
        "rated_player_id": jugador, "score": 8, "created_at": AHORA.isoformat(),
    })
    await sembrar_outcomes(db, jugador, 1, 1.0)

    metricas = await rating_calculator.calculate_player_metrics(jugador)

    # Con un partido el resultado pesa ~10%: de 8.0 baja a ~7.3, no a 4.5.
    assert 7.0 < metricas["general_rating"] < 7.6


async def test_con_muchos_resultados_el_canal_pesa_pero_no_manda_solo(mongo_en_memoria):
    """Techo del 50%: el resultado lo comparten diez a veintidós jugadores."""
    db = mongo_en_memoria
    _, jugador = await sembrar_jugador(db)
    await db.group_seed_ratings.insert_one({
        "id": str(uuid.uuid4()), "group_id": "g", "rater_id": "otro",
        "rated_player_id": jugador, "score": 8, "created_at": AHORA.isoformat(),
    })
    await sembrar_outcomes(db, jugador, 40, 2.0)

    metricas = await rating_calculator.calculate_player_metrics(jugador)

    # Con 40 partidos el peso ronda 0.45: 8*0.55 + 2*0.45 ≈ 5.1. Nunca llega a 2.
    assert 4.5 < metricas["general_rating"] < 5.6


async def test_el_modo_basico_mejora_solo(mongo_en_memoria):
    """Sin que nadie evalúe a nadie, el resultado corrige el puntaje inicial."""
    db = mongo_en_memoria
    _, jugador = await sembrar_jugador(db)
    await db.group_seed_ratings.insert_one({
        "id": str(uuid.uuid4()), "group_id": "g", "rater_id": "otro",
        "rated_player_id": jugador, "score": 5, "created_at": AHORA.isoformat(),
    })
    await sembrar_outcomes(db, jugador, 12, 8.5)

    metricas = await rating_calculator.calculate_player_metrics(jugador)

    assert metricas["general_rating"] > 6.0
    assert metricas["result_matches"] == 12


async def test_una_practica_pesa_menos_que_un_oficial(mongo_en_memoria):
    db = mongo_en_memoria
    _, en_oficiales = await sembrar_jugador(db, "Oficial")
    _, en_practicas = await sembrar_jugador(db, "Practica")
    for jugador in (en_oficiales, en_practicas):
        await db.group_seed_ratings.insert_one({
            "id": str(uuid.uuid4()), "group_id": "g", "rater_id": "otro",
            "rated_player_id": jugador, "score": 5, "created_at": AHORA.isoformat(),
        })
    await sembrar_outcomes(db, en_oficiales, 6, 9.0, "oficial")
    await sembrar_outcomes(db, en_practicas, 6, 9.0, "practica")

    con_oficiales = await rating_calculator.calculate_player_metrics(en_oficiales)
    con_practicas = await rating_calculator.calculate_player_metrics(en_practicas)

    assert con_oficiales["general_rating"] > con_practicas["general_rating"]


async def test_una_evaluacion_de_practica_tambien_pesa_menos(mongo_en_memoria):
    """El peso del tipo aplica a las evaluaciones, no sólo a los resultados."""
    db = mongo_en_memoria
    _, jugador = await sembrar_jugador(db)
    for tipo, score in (("oficial", 4), ("practica", 10)):
        match_id = str(uuid.uuid4())
        await db.matches.insert_one({
            "id": match_id, "group_id": "g", "organizer_id": "x", "title": "P",
            "modality": 5, "date": AHORA.strftime("%Y-%m-%d"), "time": "20:00",
            "location": "c", "deadline": "x", "status": "finalizado",
            "is_recurring": False, "max_players": 10, "match_type": tipo,
            "created_at": AHORA.isoformat(),
        })
        await db.peer_ratings.insert_one({
            "id": str(uuid.uuid4()), "match_id": match_id, "rater_id": "otro",
            "rated_player_id": jugador, "score": score, "created_at": AHORA.isoformat(),
        })

    metricas = await rating_calculator.calculate_player_metrics(jugador)

    # El promedio simple daría 7.0. Como el 10 vino de una práctica (peso 0.7),
    # el resultado se corre hacia el 4 del oficial.
    assert metricas["general_rating"] < 7.0


# ---------------------------------------------------------------------------
# Oficial contra práctica
# ---------------------------------------------------------------------------

async def test_con_pocos_partidos_la_comparacion_no_se_publica(mongo_en_memoria):
    """El freno principal contra vender ruido como si fuera un dato."""
    db = mongo_en_memoria
    _, jugador = await sembrar_jugador(db)
    await sembrar_outcomes(db, jugador, 2, 3.0, "oficial")
    await sembrar_outcomes(db, jugador, 8, 9.0, "practica")

    split = (await rating_calculator.calculate_player_metrics(jugador))["match_type_split"]

    assert split["comparable"] is False
    assert split["gap"] is None
    assert split["types"]["oficial"]["missing"] == SPLIT_MIN_MATCHES - 2
    assert split["types"]["practica"]["missing"] == 0


async def test_con_suficientes_de_cada_tipo_si_se_compara(mongo_en_memoria):
    db = mongo_en_memoria
    _, jugador = await sembrar_jugador(db)
    await sembrar_outcomes(db, jugador, 8, 3.0, "oficial")
    await sembrar_outcomes(db, jugador, 8, 8.0, "practica")

    split = (await rating_calculator.calculate_player_metrics(jugador))["match_type_split"]

    assert split["comparable"] is True
    # Rinde peor en los oficiales: la diferencia da negativa.
    assert split["gap"] < 0


async def test_el_encogimiento_desarma_una_racha_corta(mongo_en_memoria):
    """Tres partidos flojos no alcanzan para decir que alguien no rinde en serio."""
    db = mongo_en_memoria
    _, jugador = await sembrar_jugador(db)
    await sembrar_outcomes(db, jugador, 3, 1.0, "oficial")
    await sembrar_outcomes(db, jugador, 30, 9.0, "practica")

    metricas = await rating_calculator.calculate_player_metrics(jugador)
    oficial = metricas["match_type_split"]["types"]["oficial"]

    # El promedio crudo de sus oficiales es 1.0, pero con tres partidos el número
    # publicado se queda a mitad de camino del rating general.
    assert oficial["rating"] > 3.0


# ---------------------------------------------------------------------------
# Notas del organizador
# ---------------------------------------------------------------------------

async def test_la_nota_se_guarda_se_actualiza_y_se_borra(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id, equipo_a, _ = await armar_partido_con_equipos(db)

    await rn.guardar_nota(match_id, equipo_a[1], PlayerNoteRequest(text="  no marcó al pivot  "), user=user)
    mias = await rn.mis_notas_del_partido(match_id, user=user)
    assert mias[equipo_a[1]]["text"] == "no marcó al pivot"

    await rn.guardar_nota(match_id, equipo_a[1], PlayerNoteRequest(text="mejoró mucho"), user=user)
    mias = await rn.mis_notas_del_partido(match_id, user=user)
    assert mias[equipo_a[1]]["text"] == "mejoró mucho"
    assert len(mias) == 1

    # Vaciar el campo borra: es lo que espera el que seleccionó todo y apretó
    # borrar, y evita una colección llena de filas vacías.
    await rn.guardar_nota(match_id, equipo_a[1], PlayerNoteRequest(text="   "), user=user)
    assert await rn.mis_notas_del_partido(match_id, user=user) == {}


async def test_las_notas_de_otro_organizador_no_se_ven(mongo_en_memoria):
    """La privacidad es la decisión de diseño, no un efecto secundario."""
    db = mongo_en_memoria
    user, match_id, equipo_a, _ = await armar_partido_con_equipos(db)
    partido = await db.matches.find_one({"id": match_id}, {"_id": 0})

    otro_user, otro_perfil = await sembrar_jugador(db, "Otro DT")
    await db.group_members.insert_one({
        "id": str(uuid.uuid4()), "group_id": partido["group_id"], "player_id": otro_perfil,
        "member_role": "organizador", "status": "activo", "created_at": AHORA.isoformat(),
    })

    await rn.guardar_nota(match_id, equipo_a[1], PlayerNoteRequest(text="mío"), user=user)

    assert await rn.mis_notas_del_partido(match_id, user=otro_user) == {}
    assert await rn.mis_notas_del_jugador(equipo_a[1], user=otro_user) == []


async def test_no_se_anota_a_alguien_que_no_jugo(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id, _, _ = await armar_partido_con_equipos(db)
    _, ajeno = await sembrar_jugador(db, "Ajeno")

    with pytest.raises(HTTPException) as exc:
        await rn.guardar_nota(match_id, ajeno, PlayerNoteRequest(text="hola"), user=user)

    assert exc.value.status_code == 400


async def test_las_notas_del_jugador_vienen_de_la_mas_nueva_a_la_mas_vieja(mongo_en_memoria):
    db = mongo_en_memoria
    user, viejo_id, equipo_a, _ = await armar_partido_con_equipos(db, fecha="2026-01-10")
    objetivo = equipo_a[1]
    await rn.guardar_nota(viejo_id, objetivo, PlayerNoteRequest(text="la primera"), user=user)

    # Segundo partido, más nuevo, con el mismo jugador y el mismo organizador.
    partido = await db.matches.find_one({"id": viejo_id}, {"_id": 0})
    nuevo_id = str(uuid.uuid4())
    await db.matches.insert_one({
        **{k: v for k, v in partido.items() if k != "id"},
        "id": nuevo_id,
        "date": "2026-06-20",
    })
    await db.match_registrations.insert_one({
        "id": str(uuid.uuid4()), "match_id": nuevo_id, "player_id": objetivo,
        "status": "titular", "order": 1, "registered_at": AHORA.isoformat(),
    })
    await rn.guardar_nota(nuevo_id, objetivo, PlayerNoteRequest(text="la segunda"), user=user)

    filas = await rn.mis_notas_del_jugador(objetivo, user=user)

    assert [f["text"] for f in filas] == ["la segunda", "la primera"]
    assert filas[0]["match_date"] == "2026-06-20"


async def test_borrar_el_partido_se_lleva_las_notas(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id, equipo_a, _ = await armar_partido_con_equipos(db)
    await rn.guardar_nota(match_id, equipo_a[1], PlayerNoteRequest(text="algo"), user=user)
    admin = {"user_id": user["user_id"], "role": "admin"}

    await rm.delete_match(match_id, user=admin)

    assert await db.player_match_notes.count_documents({"match_id": match_id}) == 0
