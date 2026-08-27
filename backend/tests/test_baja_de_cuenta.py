"""
Tests de la baja de cuenta.

LA TRAMPA QUE ESTOS TESTS CUIDAN: borrar la fila del usuario habría sido lo
obvio, y habría sido exactamente el bug que la auditoría encontró en el borrado
de grupo, pero peor. Quedarían colgados los `match_outcomes` de esa persona —los
que mueven el puntaje—, sus evaluaciones a terceros, y su lugar en los equipos
de partidos ya jugados. Los partidos de LOS DEMÁS pasarían a tener diez
jugadores en vez de once.

Así que la fila sobrevive sin datos personales. La persona deja de existir como
dato personal; la historia deportiva de los demás sigue siendo cierta.
"""

from datetime import datetime, timezone
import uuid

import pytest
from fastapi import HTTPException

import routes_admin as ra
import routes_profile as rp
from services.account import NOMBRE_DE_BAJA, anonimizar_cuenta

AHORA = datetime.now(timezone.utc)


async def sembrar_cuenta(db, nombre, *, role="jugador"):
    user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id, "email": f"{nombre.lower()}@example.com",
        "password_hash": "hash-viejo", "role": role, "is_verified": True,
        "created_at": AHORA.isoformat(),
    })
    await db.player_profiles.insert_one({
        "id": profile_id, "user_id": user_id, "name": nombre,
        "email": f"{nombre.lower()}@example.com",
        "photo_url": "https://cdn.example.com/foto.jpg",
        "photo_public_id": None,
        "birth_date": "1990-05-20", "gender": "masculino",
        "player_type": "frecuente", "matches_played": 12,
        "created_at": AHORA.isoformat(),
    })
    return {"user_id": user_id, "role": role}, profile_id


async def sembrar_historial(db, profile_id):
    """Lo que NO se puede perder: la evidencia de que esta persona jugó."""
    match_id = str(uuid.uuid4())
    await db.matches.insert_one({
        "id": match_id, "group_id": str(uuid.uuid4()), "title": "El del sábado",
        "modality": 5, "date": "2026-08-01", "mode": "avanzado",
        "status": "finalizado", "counted_player_ids": [profile_id],
        "created_at": AHORA.isoformat(),
    })
    await db.match_outcomes.insert_one({
        "id": str(uuid.uuid4()), "match_id": match_id, "player_id": profile_id,
        "expected": 0.55, "score": 6.4, "created_at": AHORA.isoformat(),
    })
    await db.team_generations.insert_one({
        "id": str(uuid.uuid4()), "match_id": match_id, "status": "confirmado",
        "assignments": [{"player_id": profile_id, "team": "A", "position": "ST"}],
        "created_at": AHORA.isoformat(),
    })
    await db.peer_ratings.insert_one({
        "id": str(uuid.uuid4()), "match_id": match_id, "rater_id": profile_id,
        "rated_player_id": str(uuid.uuid4()), "score": 8,
        "created_at": AHORA.isoformat(),
    })
    return match_id


@pytest.mark.asyncio
async def test_el_historial_deportivo_sobrevive(mongo_en_memoria):
    """El test que justifica todo el diseño."""
    db = mongo_en_memoria
    user, profile_id = await sembrar_cuenta(db, "Pato")
    match_id = await sembrar_historial(db, profile_id)

    await rp.darme_de_baja(user=user)

    assert await db.match_outcomes.count_documents({"player_id": profile_id}) == 1
    assert await db.peer_ratings.count_documents({"rater_id": profile_id}) == 1
    generacion = await db.team_generations.find_one({"match_id": match_id}, {"_id": 0})
    assert generacion["assignments"][0]["player_id"] == profile_id
    partido = await db.matches.find_one({"id": match_id}, {"_id": 0})
    assert profile_id in partido["counted_player_ids"]


@pytest.mark.asyncio
async def test_el_perfil_queda_sin_datos_personales(mongo_en_memoria):
    db = mongo_en_memoria
    user, profile_id = await sembrar_cuenta(db, "Pato")

    await rp.darme_de_baja(user=user)

    perfil = await db.player_profiles.find_one({"id": profile_id}, {"_id": 0})
    assert perfil is not None, "el perfil se borró: el historial de los demás quedaría roto"
    assert perfil["name"] == NOMBRE_DE_BAJA
    assert perfil["email"] is None
    assert perfil["photo_url"] is None
    assert perfil["birth_date"] is None
    assert perfil["gender"] is None
    assert perfil["deleted_at"]


@pytest.mark.asyncio
async def test_la_cuenta_no_puede_volver_a_entrar(mongo_en_memoria):
    db = mongo_en_memoria
    user, _ = await sembrar_cuenta(db, "Pato")

    await rp.darme_de_baja(user=user)

    usuario = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    assert usuario["deleted_at"]
    assert usuario["password_hash"] == "!"


@pytest.mark.asyncio
async def test_se_libera_el_email_para_poder_volver_a_registrarse(mongo_en_memoria):
    """El email real se suelta: si esa persona quiere volver, puede.

    Y no queda en null, porque el índice único de users.email no acepta varios.
    """
    db = mongo_en_memoria
    user, _ = await sembrar_cuenta(db, "Pato")

    await rp.darme_de_baja(user=user)

    usuario = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    assert usuario["email"] != "pato@example.com"
    assert usuario["email"].startswith("baja+")
    assert await db.users.count_documents({"email": "pato@example.com"}) == 0


@pytest.mark.asyncio
async def test_sale_de_los_grupos(mongo_en_memoria):
    db = mongo_en_memoria
    user, profile_id = await sembrar_cuenta(db, "Pato")
    group_id = str(uuid.uuid4())
    await db.group_members.insert_one({
        "id": str(uuid.uuid4()), "group_id": group_id, "player_id": profile_id,
        "member_role": "frecuente", "status": "activo",
        "created_at": AHORA.isoformat(),
    })

    await rp.darme_de_baja(user=user)

    membresia = await db.group_members.find_one({"group_id": group_id, "player_id": profile_id}, {"_id": 0})
    assert membresia["status"] == "inactivo"


@pytest.mark.asyncio
async def test_se_da_de_baja_de_los_partidos_que_no_se_jugaron(mongo_en_memoria):
    """De los futuros sí; de los jugados no, porque ahí estuvo de verdad."""
    db = mongo_en_memoria
    user, profile_id = await sembrar_cuenta(db, "Pato")

    futuro = str(uuid.uuid4())
    jugado = str(uuid.uuid4())
    await db.matches.insert_many([
        {"id": futuro, "group_id": "g", "title": "El que viene", "modality": 5,
         "date": "2026-12-01", "mode": "avanzado", "status": "abierto",
         "counted_player_ids": [], "created_at": AHORA.isoformat()},
        {"id": jugado, "group_id": "g", "title": "El que fue", "modality": 5,
         "date": "2026-01-01", "mode": "avanzado", "status": "finalizado",
         "counted_player_ids": [profile_id], "created_at": AHORA.isoformat()},
    ])
    for match_id in (futuro, jugado):
        await db.match_registrations.insert_one({
            "id": str(uuid.uuid4()), "match_id": match_id, "player_id": profile_id,
            "status": "titular", "order": 1, "registered_at": AHORA.isoformat(),
        })

    await rp.darme_de_baja(user=user)

    del_futuro = await db.match_registrations.find_one({"match_id": futuro}, {"_id": 0})
    del_jugado = await db.match_registrations.find_one({"match_id": jugado}, {"_id": 0})
    assert del_futuro["status"] == "baja"
    assert del_jugado["status"] == "titular"


@pytest.mark.asyncio
async def test_darse_de_baja_dos_veces_no_rompe(mongo_en_memoria):
    db = mongo_en_memoria
    user, _ = await sembrar_cuenta(db, "Pato")

    await rp.darme_de_baja(user=user)
    segunda = await anonimizar_cuenta(user["user_id"])

    assert segunda["ya_estaba"] is True


# --------------------------------------------------------------------- #
# Baja por admin
# --------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_un_admin_puede_dar_de_baja_a_otro(mongo_en_memoria):
    db = mongo_en_memoria
    admin, _ = await sembrar_cuenta(db, "Jefa", role="admin")
    otro, otro_profile = await sembrar_cuenta(db, "Otro")

    await ra.dar_de_baja_usuario(otro["user_id"], user=admin)

    perfil = await db.player_profiles.find_one({"id": otro_profile}, {"_id": 0})
    assert perfil["name"] == NOMBRE_DE_BAJA


@pytest.mark.asyncio
async def test_el_admin_no_se_da_de_baja_a_si_mismo_desde_el_panel(mongo_en_memoria):
    """Para que nadie se quede sin admin por un clic distraído en la lista."""
    db = mongo_en_memoria
    admin, _ = await sembrar_cuenta(db, "Jefa", role="admin")

    with pytest.raises(HTTPException) as exc:
        await ra.dar_de_baja_usuario(admin["user_id"], user=admin)

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_dar_de_baja_a_alguien_que_no_existe_es_404(mongo_en_memoria):
    db = mongo_en_memoria
    admin, _ = await sembrar_cuenta(db, "Jefa", role="admin")

    with pytest.raises(HTTPException) as exc:
        await ra.dar_de_baja_usuario("no-existe", user=admin)

    assert exc.value.status_code == 404
