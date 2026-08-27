"""
Tests de la fusión de un invitado dentro de una cuenta real.

`merge_guest_into_profile` reasigna las referencias del invitado al perfil
verdadero y después borra el invitado. El problema es que la lista de
colecciones a reasignar quedó congelada en el momento en que se escribió, y
después el proyecto sumó `match_outcomes`, `self_evaluations` y
`player_match_notes` sin que nadie volviera a tocarla.

`match_outcomes` es la peor de las tres: es la colección que mueve el puntaje.
Un invitado que jugó diez partidos y se vincula a su cuenta perdía los diez
outcomes —el rating le bajaba de golpe— mientras que el `matches_played` SÍ se
sumaba. O sea, denominador inflado contra numerador vacío: el índice de
confianza quedaba diciendo "de este jugador sabemos bastante" sobre evidencia
que ya no existía.

Y como el perfil origen se borraba con `delete_one`, no había forma de
reconstruirlo. Por eso el borrado ahora es lógico: la fila sobrevive marcada,
y una fusión mal hecha se puede deshacer.
"""

from datetime import datetime, timezone
import uuid

import pytest

from services.guest_merge import merge_guest_into_profile

AHORA = datetime.now(timezone.utc)


async def sembrar(db):
    """Un invitado con rastro en todas las colecciones que lo referencian."""
    invitado_id = str(uuid.uuid4())
    real_id = str(uuid.uuid4())
    tercero_id = str(uuid.uuid4())
    match_id = str(uuid.uuid4())

    await db.player_profiles.insert_many([
        {"id": invitado_id, "user_id": None, "name": "Juan (invitado)",
         "email": "juan@example.com", "player_type": "invitado",
         "matches_played": 10, "created_at": AHORA.isoformat()},
        {"id": real_id, "user_id": str(uuid.uuid4()), "name": "Juan",
         "email": "juan@example.com", "player_type": "frecuente",
         "matches_played": 0, "created_at": AHORA.isoformat()},
        {"id": tercero_id, "user_id": str(uuid.uuid4()), "name": "Otro",
         "player_type": "frecuente", "matches_played": 4,
         "created_at": AHORA.isoformat()},
    ])

    comun = {"match_id": match_id, "created_at": AHORA.isoformat()}
    await db.match_outcomes.insert_one({"id": str(uuid.uuid4()), "player_id": invitado_id,
                                        "expected": 0.55, "score": 6.4, **comun})
    await db.self_evaluations.insert_one({"id": str(uuid.uuid4()), "player_id": invitado_id,
                                          "score": 7, **comun})
    await db.player_match_notes.insert_one({"id": str(uuid.uuid4()), "author_id": tercero_id,
                                            "player_id": invitado_id, "note": "rapido", **comun})
    # El invitado como EVALUADOR, no como evaluado: la mitad que faltaba migrar.
    await db.peer_ratings.insert_one({"id": str(uuid.uuid4()), "rater_id": invitado_id,
                                      "rated_player_id": tercero_id, "score": 8, **comun})
    await db.peer_ratings.insert_one({"id": str(uuid.uuid4()), "rater_id": tercero_id,
                                      "rated_player_id": invitado_id, "score": 6, **comun})
    await db.stats_final.insert_one({"id": str(uuid.uuid4()), "player_id": invitado_id,
                                     "values": {"goals": 1}, **comun})
    await db.stats_proposals.insert_one({"id": str(uuid.uuid4()), "player_id": tercero_id,
                                         "proposed_by": invitado_id, "values": {"goals": 1},
                                         "votes": [], **comun})
    await db.match_registrations.insert_one({"id": str(uuid.uuid4()), "player_id": tercero_id,
                                             "registered_by": invitado_id, "status": "titular",
                                             "order": 1, "registered_at": AHORA.isoformat(),
                                             **comun})
    await db.player_profiles.update_one({"id": tercero_id},
                                        {"$set": {"created_by": invitado_id}})
    await db.matches.insert_one({
        "id": match_id, "group_id": str(uuid.uuid4()), "title": "Un partido",
        "modality": 5, "date": "2026-08-01", "mode": "avanzado", "status": "finalizado",
        "counted_player_ids": sorted([invitado_id, tercero_id]),
        "created_at": AHORA.isoformat(),
    })

    return invitado_id, real_id, tercero_id, match_id


@pytest.mark.asyncio
async def test_migra_los_outcomes_que_mueven_el_puntaje(mongo_en_memoria):
    db = mongo_en_memoria
    invitado_id, real_id, _, _ = await sembrar(db)

    await merge_guest_into_profile(invitado_id, real_id)

    assert await db.match_outcomes.count_documents({"player_id": invitado_id}) == 0
    assert await db.match_outcomes.count_documents({"player_id": real_id}) == 1


@pytest.mark.asyncio
async def test_migra_todas_las_referencias_al_invitado(mongo_en_memoria):
    db = mongo_en_memoria
    invitado_id, real_id, _, _ = await sembrar(db)

    await merge_guest_into_profile(invitado_id, real_id)

    pendientes = {
        "self_evaluations": {"player_id": invitado_id},
        "player_match_notes": {"player_id": invitado_id},
        "peer_ratings (evaluador)": {"rater_id": invitado_id},
        "peer_ratings (evaluado)": {"rated_player_id": invitado_id},
        "stats_final": {"player_id": invitado_id},
        "stats_proposals (autor)": {"proposed_by": invitado_id},
        "match_registrations (anotó a otro)": {"registered_by": invitado_id},
        "player_profiles (creó a otro)": {"created_by": invitado_id},
    }
    for etiqueta, filtro in pendientes.items():
        coleccion = etiqueta.split(" ")[0]
        quedan = await db[coleccion].count_documents(filtro)
        assert quedan == 0, f"{etiqueta} sigue apuntando al invitado borrado"


@pytest.mark.asyncio
async def test_el_partido_cuenta_al_jugador_real(mongo_en_memoria):
    """`counted_player_ids` es el diferencial del contador de partidos jugados.

    Si sigue nombrando al invitado, el día que alguien toque la asistencia de ese
    partido el sincronizador cree que el jugador real nunca fue contado y le suma
    el partido otra vez.
    """
    db = mongo_en_memoria
    invitado_id, real_id, _, match_id = await sembrar(db)

    await merge_guest_into_profile(invitado_id, real_id)

    partido = await db.matches.find_one({"id": match_id}, {"_id": 0})
    assert invitado_id not in partido["counted_player_ids"]
    assert real_id in partido["counted_player_ids"]


@pytest.mark.asyncio
async def test_el_invitado_no_se_borra_sino_que_queda_marcado(mongo_en_memoria):
    """Borrado lógico: una fusión mal hecha se tiene que poder deshacer.

    Con `delete_one` no había forma de reconstruir nada, porque el perfil origen
    dejaba de existir en el mismo momento en que se descubría el problema.
    """
    db = mongo_en_memoria
    invitado_id, real_id, _, _ = await sembrar(db)

    await merge_guest_into_profile(invitado_id, real_id)

    invitado = await db.player_profiles.find_one({"id": invitado_id}, {"_id": 0})
    assert invitado is not None, "el invitado se borró: la fusión es irreversible"
    assert invitado["merged_into"] == real_id
    assert invitado["player_type"] == "fusionado"


@pytest.mark.asyncio
async def test_el_invitado_fusionado_no_se_vuelve_a_fusionar(mongo_en_memoria):
    """Sobrevivir a la fusión no puede significar seguir disponible."""
    db = mongo_en_memoria
    invitado_id, real_id, _, _ = await sembrar(db)

    await merge_guest_into_profile(invitado_id, real_id)
    segunda = await merge_guest_into_profile(invitado_id, real_id)

    assert segunda is None


@pytest.mark.asyncio
async def test_se_suman_los_partidos_jugados(mongo_en_memoria):
    db = mongo_en_memoria
    invitado_id, real_id, _, _ = await sembrar(db)

    await merge_guest_into_profile(invitado_id, real_id)

    real = await db.player_profiles.find_one({"id": real_id}, {"_id": 0})
    assert real["matches_played"] == 10
