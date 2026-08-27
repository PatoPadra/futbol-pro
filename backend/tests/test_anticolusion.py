"""
Tests del arreglo de colusión en las evaluaciones entre pares.

EL P0 QUE ESTO CIERRA. Nada exigía calificar a un mínimo de compañeros ni
normalizaba por evaluador, así que tres amigos que se ponían 10 entre ellos y no
calificaban a nadie más llegaban a 8.21, contra 6.29 de un jugador honesto al
que sus doce compañeros le ponían 7. Casi dos puntos comprados — y en el
balanceador eso es medio jugador de diferencia.

DOS MECANISMOS CON PAPELES DISTINTOS, y los dos hacen falta:

  - La cobertura mínima ataca "no calificaban a nadie más". Sola no alcanza:
    obligaría al colusor a poner notas, y las pondría bajas.
  - La normalización ataca "se ponían 10". Es la que de verdad desactiva el
    ataque, porque inflar a todo el mundo deja de dar ventaja.

Se hace ahora y no antes porque hay cero evaluaciones cargadas en la base: es
el único momento en que cambiar la fórmula no le mueve el puntaje a nadie
retroactivamente.
"""

from datetime import datetime, timezone
import uuid

import pytest
from fastapi import HTTPException

import routes_post_match as rpm
from constants import COBERTURA_MINIMA_DE_EVALUACION, MINIMO_PARA_NORMALIZAR
from models import PeerRatingBatchRequest
from rating_calculator import _normalizar_por_evaluador, _weighted_average

AHORA = datetime.now(timezone.utc)


def nota(match_id, rater_id, rated_id, score):
    return {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "rater_id": rater_id,
        "rated_player_id": rated_id,
        "score": score,
        "created_at": AHORA.isoformat(),
    }


# --------------------------------------------------------------------- #
# La normalización
# --------------------------------------------------------------------- #

def test_inflar_a_todos_deja_de_dar_ventaja():
    """EL test del bug, con los números de la auditoría.

    Tres amigos que se ponen 10 entre ellos, contra un evaluador que reparte
    notas distintas. Después de normalizar, el 10 del amigo no vale más que un
    7 de alguien que sí distingue: los dos quedan en el mismo lugar de SU escala.
    """
    # El colusor le pone 10 a sus tres amigos y nada más.
    del_colusor = [nota("m1", "amigo", f"amigo{i}", 10) for i in range(3)]
    # Un evaluador honesto reparte de verdad.
    del_honesto = [
        nota("m1", "honesto", "amigo0", 6),
        nota("m1", "honesto", "amigo1", 7),
        nota("m1", "honesto", "amigo2", 8),
    ]
    todas = del_colusor + del_honesto

    normalizadas = _normalizar_por_evaluador(todas, todas)
    por_evaluador = {}
    for n in normalizadas:
        por_evaluador.setdefault(n["rater_id"], []).append(n["score"])

    # El colusor no distinguió: sus tres notas colapsan al centro.
    assert all(s == pytest.approx(5.0) for s in por_evaluador["amigo"]), por_evaluador["amigo"]
    # El honesto sí distinguió: sus notas se abren alrededor del centro.
    assert min(por_evaluador["honesto"]) < 5.0 < max(por_evaluador["honesto"])


def test_el_que_es_generoso_con_todos_no_regala_puntos():
    """Un 9 de quien reparte nueves vale lo mismo que un 6 de quien reparte seises."""
    generoso = [nota("m1", "generoso", f"p{i}", s) for i, s in enumerate([8, 9, 10])]
    exigente = [nota("m1", "exigente", f"p{i}", s) for i, s in enumerate([4, 5, 6])]
    todas = generoso + exigente

    normalizadas = {(n["rater_id"], n["rated_player_id"]): n["score"]
                    for n in _normalizar_por_evaluador(todas, todas)}

    # p1 recibió el valor del medio de los dos evaluadores: queda en el centro.
    assert normalizadas[("generoso", "p1")] == pytest.approx(5.0)
    assert normalizadas[("exigente", "p1")] == pytest.approx(5.0)
    # Y el mejor de cada uno queda igual de arriba, aunque uno diga 10 y otro 6.
    assert normalizadas[("generoso", "p2")] == pytest.approx(normalizadas[("exigente", "p2")])


def test_con_pocas_notas_no_se_inventa_una_escala():
    """Con dos números no hay dispersión que estimar: se usan crudos."""
    pocas = [nota("m1", "apurado", "p0", 9), nota("m1", "apurado", "p1", 3)]

    normalizadas = _normalizar_por_evaluador(pocas, pocas)

    assert [n["score"] for n in normalizadas] == [9, 3]
    assert MINIMO_PARA_NORMALIZAR == 3


def test_la_escala_es_por_evaluador_Y_por_partido():
    """La vara de alguien puede cambiar de una noche a la otra."""
    todas = (
        [nota("m1", "juan", f"p{i}", s) for i, s in enumerate([8, 9, 10])]
        + [nota("m2", "juan", f"p{i}", s) for i, s in enumerate([3, 4, 5])]
    )

    normalizadas = {(n["match_id"], n["rated_player_id"]): n["score"]
                    for n in _normalizar_por_evaluador(todas, todas)}

    # El 10 del primer partido y el 5 del segundo son ambos "lo mejor de esa
    # noche" para Juan, así que quedan en el mismo lugar.
    assert normalizadas[("m1", "p2")] == pytest.approx(normalizadas[("m2", "p2")])


def test_las_notas_normalizadas_no_se_salen_de_la_escala():
    """Un evaluador con un outlier enorme no puede empujar a nadie fuera de 1-10."""
    extremas = [nota("m1", "raro", f"p{i}", s) for i, s in enumerate([1, 1, 1, 10])]

    normalizadas = _normalizar_por_evaluador(extremas, extremas)

    assert all(1.0 <= n["score"] <= 10.0 for n in normalizadas)


def test_no_toca_la_lista_de_entrada():
    original = [nota("m1", "juan", f"p{i}", s) for i, s in enumerate([8, 9, 10])]
    copia = [dict(n) for n in original]

    _normalizar_por_evaluador(original, original)

    assert original == copia


def test_el_promedio_del_colusor_baja_al_de_cualquiera():
    """La consecuencia final: el amigo inflado deja de sacar ventaja.

    Antes: el jugador que sólo recibe dieces promedia 10. Ahora promedia lo
    mismo que si le hubieran puesto la nota del medio, porque quien se los puso
    no distinguió a nadie.
    """
    todas = [nota("m1", "amigo", f"amigo{i}", 10) for i in range(3)]
    del_inflado = [n for n in todas if n["rated_player_id"] == "amigo0"]

    crudo = _weighted_average(del_inflado)
    normalizado = _weighted_average(_normalizar_por_evaluador(del_inflado, todas))

    assert crudo == pytest.approx(10.0)
    assert normalizado == pytest.approx(5.0)
    assert normalizado < crudo


# --------------------------------------------------------------------- #
# La cobertura mínima
# --------------------------------------------------------------------- #

async def sembrar_partido(db, cuantos=10):
    user_id = str(uuid.uuid4())
    evaluador_id = str(uuid.uuid4())
    group_id = str(uuid.uuid4())
    match_id = str(uuid.uuid4())

    await db.player_profiles.insert_one({
        "id": evaluador_id, "user_id": user_id, "name": "Evaluador",
        "player_type": "frecuente", "matches_played": 5,
        "created_at": AHORA.isoformat(),
    })
    await db.groups.insert_one({
        "id": group_id, "name": "Los del martes",
        "created_by": evaluador_id, "created_at": AHORA.isoformat(),
    })
    await db.matches.insert_one({
        "id": match_id, "group_id": group_id, "organizer_id": evaluador_id,
        "title": "El del sábado", "modality": 5, "date": "2026-08-01",
        "mode": "avanzado", "status": "finalizado", "counted_player_ids": [],
        "created_at": AHORA.isoformat(),
    })

    companeros = []
    for i in range(cuantos):
        pid = str(uuid.uuid4())
        companeros.append(pid)
        await db.player_profiles.insert_one({
            "id": pid, "user_id": str(uuid.uuid4()), "name": f"Jugador {i}",
            "player_type": "frecuente", "matches_played": 5,
            "created_at": AHORA.isoformat(),
        })

    for pid in [evaluador_id, *companeros]:
        await db.match_registrations.insert_one({
            "id": str(uuid.uuid4()), "match_id": match_id, "player_id": pid,
            "status": "titular", "order": 1, "registered_at": AHORA.isoformat(),
        })
        await db.group_members.insert_one({
            "id": str(uuid.uuid4()), "group_id": group_id, "player_id": pid,
            "member_role": "frecuente", "status": "activo",
            "created_at": AHORA.isoformat(),
        })

    return {"user_id": user_id, "role": "jugador"}, match_id, companeros


@pytest.mark.asyncio
async def test_no_se_puede_calificar_solo_a_los_amigos(mongo_en_memoria):
    """El caso exacto: tres de diez."""
    db = mongo_en_memoria
    user, match_id, companeros = await sembrar_partido(db, cuantos=10)

    with pytest.raises(HTTPException) as exc:
        await rpm.submit_ratings(
            match_id,
            PeerRatingBatchRequest(ratings=[
                {"rated_player_id": pid, "score": 10} for pid in companeros[:3]
            ]),
            user=user,
        )

    assert exc.value.status_code == 400
    assert "al menos" in exc.value.detail
    assert await db.peer_ratings.count_documents({"match_id": match_id}) == 0


@pytest.mark.asyncio
async def test_calificar_a_la_mayoria_alcanza(mongo_en_memoria):
    """No hace falta el 100%: siempre hay alguien con quien no te cruzaste."""
    db = mongo_en_memoria
    user, match_id, companeros = await sembrar_partido(db, cuantos=10)
    minimo = int(10 * COBERTURA_MINIMA_DE_EVALUACION)

    await rpm.submit_ratings(
        match_id,
        PeerRatingBatchRequest(ratings=[
            {"rated_player_id": pid, "score": 7} for pid in companeros[:minimo]
        ]),
        user=user,
    )

    assert await db.peer_ratings.count_documents({"match_id": match_id}) == minimo


@pytest.mark.asyncio
async def test_calificar_a_todos_obviamente_alcanza(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id, companeros = await sembrar_partido(db, cuantos=10)

    await rpm.submit_ratings(
        match_id,
        PeerRatingBatchRequest(ratings=[
            {"rated_player_id": pid, "score": 8} for pid in companeros
        ]),
        user=user,
    )

    assert await db.peer_ratings.count_documents({"match_id": match_id}) == 10


@pytest.mark.asyncio
async def test_un_partido_de_dos_no_exige_imposibles(mongo_en_memoria):
    """Con un solo compañero, calificarlo es el 100%."""
    db = mongo_en_memoria
    user, match_id, companeros = await sembrar_partido(db, cuantos=1)

    await rpm.submit_ratings(
        match_id,
        PeerRatingBatchRequest(ratings=[{"rated_player_id": companeros[0], "score": 8}]),
        user=user,
    )

    assert await db.peer_ratings.count_documents({"match_id": match_id}) == 1


@pytest.mark.asyncio
async def test_el_mensaje_dice_cuantos_faltan(mongo_en_memoria):
    """Un error que no dice qué hacer es un error inútil."""
    db = mongo_en_memoria
    user, match_id, companeros = await sembrar_partido(db, cuantos=10)

    with pytest.raises(HTTPException) as exc:
        await rpm.submit_ratings(
            match_id,
            PeerRatingBatchRequest(ratings=[{"rated_player_id": companeros[0], "score": 9}]),
            user=user,
        )

    assert "6" in exc.value.detail   # el mínimo
    assert "10" in exc.value.detail  # sobre cuántos
