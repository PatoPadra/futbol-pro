"""
Tests del borrado de grupo en cascada.

Borrar un partido suelto limpiaba ocho colecciones; borrar un grupo entero
limpiaba seis. Las dos que faltaban eran `match_outcomes` y
`player_match_notes` — y `match_outcomes` es justo la que el cálculo de rating
lee POR `player_id`, así que las filas huérfanas seguían moviéndole el puntaje a
gente por partidos que ya no existían. Para siempre, y sin forma de notarlo.

Tampoco se revertía `matches_played`, y no se miraba si el grupo estaba jugando
un torneo: al borrarlo, el `tournament_teams` quedaba apuntando a un grupo
inexistente y la llave se volvía inejecutable para TODOS los demás equipos.

Dos reglas se fijan acá:

1. **Una sola cascada.** Borrar partidos limpia lo mismo, se llegue desde donde
   se llegue. Que hubiera dos listas distintas es lo que permitió que divergieran.
2. **No se rompe el torneo de otra gente en silencio.** Quien borra es
   organizador de SU grupo, no del torneo: si el torneo sigue vivo, se rechaza.
"""

from datetime import datetime, timezone
import uuid

import pytest
from fastapi import HTTPException

import routes_groups as rg

AHORA = datetime.now(timezone.utc)


async def sembrar_todo(db, *, con_torneo=None):
    """Un grupo con un partido finalizado y datos en las ocho colecciones hijas."""
    user_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())
    otro_id = str(uuid.uuid4())
    await db.player_profiles.insert_many([
        {"id": org_id, "user_id": user_id, "name": "Orga", "player_type": "frecuente",
         "matches_played": 5, "created_at": AHORA.isoformat()},
        {"id": otro_id, "user_id": str(uuid.uuid4()), "name": "Otro",
         "player_type": "frecuente", "matches_played": 5, "created_at": AHORA.isoformat()},
    ])

    group_id = str(uuid.uuid4())
    await db.groups.insert_one({
        "id": group_id, "name": "Los del martes",
        "created_by": org_id, "created_at": AHORA.isoformat(),
    })
    for pid in (org_id, otro_id):
        await db.group_members.insert_one({
            "id": str(uuid.uuid4()), "group_id": group_id, "player_id": pid,
            "member_role": "organizador" if pid == org_id else "frecuente",
            "status": "activo", "created_at": AHORA.isoformat(),
        })

    match_id = str(uuid.uuid4())
    await db.matches.insert_one({
        "id": match_id, "group_id": group_id, "organizer_id": org_id,
        "title": "El último", "modality": 5, "date": "2026-08-01",
        "mode": "avanzado", "status": "finalizado",
        "counted_player_ids": sorted([org_id, otro_id]),
        "result": {"home_score": 2, "away_score": 1},
        "created_at": AHORA.isoformat(),
    })

    comun = {"match_id": match_id, "created_at": AHORA.isoformat()}
    await db.match_registrations.insert_one({"id": str(uuid.uuid4()), "player_id": org_id,
                                             "status": "titular", "order": 1,
                                             "registered_at": AHORA.isoformat(), **comun})
    await db.team_generations.insert_one({"id": str(uuid.uuid4()), "assignments": [],
                                          "status": "confirmado", **comun})
    await db.peer_ratings.insert_one({"id": str(uuid.uuid4()), "rater_id": org_id,
                                      "rated_player_id": otro_id, "score": 7, **comun})
    await db.self_evaluations.insert_one({"id": str(uuid.uuid4()), "player_id": org_id,
                                          "score": 6, **comun})
    await db.stats_final.insert_one({"id": str(uuid.uuid4()), "player_id": org_id,
                                     "values": {"goals": 2}, **comun})
    await db.stats_proposals.insert_one({"id": str(uuid.uuid4()), "player_id": org_id,
                                         "values": {"goals": 2}, "votes": [], **comun})
    await db.match_outcomes.insert_one({"id": str(uuid.uuid4()), "player_id": org_id,
                                        "expected": 0.61, "score": 6.2, **comun})
    await db.player_match_notes.insert_one({"id": str(uuid.uuid4()), "author_id": org_id,
                                            "player_id": otro_id, "note": "anduvo bien", **comun})

    if con_torneo:
        torneo_id = str(uuid.uuid4())
        await db.tournaments.insert_one({
            "id": torneo_id, "name": "Copa de invierno", "status": con_torneo,
            "created_by": org_id, "created_at": AHORA.isoformat(),
        })
        await db.tournament_teams.insert_one({
            "id": str(uuid.uuid4()), "tournament_id": torneo_id, "group_id": group_id,
            "name": "Los del martes", "seed": 1, "created_at": AHORA.isoformat(),
        })

    return {"user_id": user_id, "role": "jugador"}, group_id, match_id, org_id, otro_id


COLECCIONES_HIJAS = [
    "match_registrations", "team_generations", "peer_ratings", "self_evaluations",
    "stats_final", "stats_proposals", "match_outcomes", "player_match_notes",
]


@pytest.mark.asyncio
async def test_la_cascada_limpia_las_ocho_colecciones(mongo_en_memoria):
    db = mongo_en_memoria
    user, group_id, match_id, _, _ = await sembrar_todo(db)

    await rg.delete_group(group_id, user=user)

    for nombre in COLECCIONES_HIJAS:
        quedan = await db[nombre].count_documents({"match_id": match_id})
        assert quedan == 0, f"{nombre} quedó con {quedan} documentos huérfanos"

    assert await db.matches.count_documents({"id": match_id}) == 0
    assert await db.groups.count_documents({"id": group_id}) == 0
    assert await db.group_members.count_documents({"group_id": group_id}) == 0


@pytest.mark.asyncio
async def test_se_devuelve_el_partido_jugado_al_contador(mongo_en_memoria):
    """`matches_played` alimenta el índice de confianza del rating.

    Si el partido desaparece pero el contador no baja, esa persona queda con un
    denominador inflado: el sistema le cree más de lo que la evidencia aguanta.
    """
    db = mongo_en_memoria
    user, group_id, _, org_id, otro_id = await sembrar_todo(db)

    await rg.delete_group(group_id, user=user)

    for pid in (org_id, otro_id):
        perfil = await db.player_profiles.find_one({"id": pid}, {"_id": 0})
        assert perfil["matches_played"] == 4, f"{perfil['name']} quedó en {perfil['matches_played']}"


@pytest.mark.asyncio
async def test_no_se_puede_borrar_un_grupo_que_esta_jugando_un_torneo(mongo_en_memoria):
    """Rechazar es más honesto que romperle la llave a los otros equipos."""
    db = mongo_en_memoria
    user, group_id, match_id, _, _ = await sembrar_todo(db, con_torneo="fase_grupos")

    with pytest.raises(HTTPException) as exc:
        await rg.delete_group(group_id, user=user)

    assert exc.value.status_code == 409
    # Y nada se borró a medias.
    assert await db.groups.count_documents({"id": group_id}) == 1
    assert await db.matches.count_documents({"id": match_id}) == 1


@pytest.mark.asyncio
async def test_con_el_torneo_terminado_si_se_puede_borrar(mongo_en_memoria):
    db = mongo_en_memoria
    user, group_id, _, _, _ = await sembrar_todo(db, con_torneo="finalizado")

    await rg.delete_group(group_id, user=user)

    assert await db.groups.count_documents({"id": group_id}) == 0
    assert await db.tournament_teams.count_documents({"group_id": group_id}) == 0
