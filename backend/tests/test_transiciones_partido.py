"""
Tests de las transiciones de estado de un partido.

`close_registrations` y `complete_match` escribían el estado nuevo sin mirar
nunca el actual. Eso permitía dos cosas que no existen en la realidad:

- Un partido **finalizado** volviendo a **cerrado**. Mientras estaba así, los
  seis endpoints de post-partido —que se guardan con
  `status not in ["finalizado", "completado"]`— quedaban abiertos de nuevo sobre
  datos ya cargados, y el partido figuraba cerrado con `counted_player_ids`
  lleno, que es un estado que no debería poder existir.
- Un partido **abierto** saltando a **completado**, con gente todavía
  anotándose y `counted_player_ids` vacío para siempre.

El modelo a copiar ya estaba adentro del proyecto: la máquina de estados de
torneo escribe estado y campeón juntos en todas las ramas, incluida la de
desfinalizar al corregir una final. Acá se le da a los partidos la misma red.
"""

from datetime import datetime, timezone
import uuid

import pytest
from fastapi import HTTPException

import routes_matches as rm
import routes_post_match as rpm
from constants import MATCH_STATUSES, TRANSICIONES_PARTIDO

AHORA = datetime.now(timezone.utc)


async def sembrar(db, status):
    user_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())
    await db.player_profiles.insert_one({
        "id": org_id, "user_id": user_id, "name": "Orga",
        "player_type": "frecuente", "matches_played": 0,
        "created_at": AHORA.isoformat(),
    })
    group_id = str(uuid.uuid4())
    await db.groups.insert_one({
        "id": group_id, "name": "Los del martes",
        "created_by": org_id, "created_at": AHORA.isoformat(),
    })
    await db.group_members.insert_one({
        "id": str(uuid.uuid4()), "group_id": group_id, "player_id": org_id,
        "member_role": "organizador", "status": "activo",
        "created_at": AHORA.isoformat(),
    })
    match_id = str(uuid.uuid4())
    await db.matches.insert_one({
        "id": match_id, "group_id": group_id, "organizer_id": org_id,
        "title": "Partido", "modality": 5, "date": "2026-08-01",
        "mode": "avanzado", "status": status, "counted_player_ids": [],
        "created_at": AHORA.isoformat(),
    })
    return {"user_id": user_id, "role": "jugador"}, match_id


async def estado(db, match_id):
    doc = await db.matches.find_one({"id": match_id}, {"_id": 0})
    return doc["status"]


def test_el_catalogo_incluye_cancelado():
    """`cancelado` existe en la base y en el front desde siempre; faltaba acá."""
    assert "cancelado" in MATCH_STATUSES


def test_toda_transicion_declarada_usa_estados_del_catalogo():
    """La tabla no puede nombrar un estado que no existe."""
    for origen, destinos in TRANSICIONES_PARTIDO.items():
        assert origen in MATCH_STATUSES, f"origen desconocido: {origen}"
        for destino in destinos:
            assert destino in MATCH_STATUSES, f"destino desconocido: {destino}"


@pytest.mark.asyncio
async def test_cerrar_inscripciones_desde_abierto_funciona(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id = await sembrar(db, "abierto")

    await rm.close_registrations(match_id, user=user)

    assert await estado(db, match_id) == "cerrado"


@pytest.mark.asyncio
async def test_un_partido_finalizado_no_vuelve_a_cerrado(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id = await sembrar(db, "finalizado")

    with pytest.raises(HTTPException) as exc:
        await rm.close_registrations(match_id, user=user)

    assert exc.value.status_code == 409
    assert await estado(db, match_id) == "finalizado"


@pytest.mark.asyncio
async def test_un_partido_cancelado_no_se_reabre_cerrandolo(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id = await sembrar(db, "cancelado")

    with pytest.raises(HTTPException) as exc:
        await rm.close_registrations(match_id, user=user)

    assert exc.value.status_code == 409
    assert await estado(db, match_id) == "cancelado"


@pytest.mark.asyncio
async def test_un_partido_abierto_no_salta_a_completado(mongo_en_memoria):
    """El salto que dejaba `counted_player_ids` vacío para siempre."""
    db = mongo_en_memoria
    user, match_id = await sembrar(db, "abierto")

    with pytest.raises(HTTPException) as exc:
        await rpm.complete_match(match_id, user=user)

    assert exc.value.status_code == 409
    assert await estado(db, match_id) == "abierto"


@pytest.mark.asyncio
async def test_completar_desde_finalizado_funciona(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id = await sembrar(db, "finalizado")

    await rpm.complete_match(match_id, user=user)

    assert await estado(db, match_id) == "completado"


@pytest.mark.asyncio
async def test_completar_dos_veces_no_rompe(mongo_en_memoria):
    """Idempotencia: el doble click no puede ser un 409.

    Pedir el estado en el que ya se está no es una transición inválida, es una
    repetición. La app tiene un botón que la gente toca dos veces.
    """
    db = mongo_en_memoria
    user, match_id = await sembrar(db, "completado")

    await rpm.complete_match(match_id, user=user)

    assert await estado(db, match_id) == "completado"


@pytest.mark.asyncio
async def test_cerrar_dos_veces_no_rompe(mongo_en_memoria):
    db = mongo_en_memoria
    user, match_id = await sembrar(db, "cerrado")

    await rm.close_registrations(match_id, user=user)

    assert await estado(db, match_id) == "cerrado"
