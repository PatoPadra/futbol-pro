"""
Tests de autorización del detalle de jugador.

`list_players` restringe con cuidado a los grupos compartidos, y las métricas
pasan por `get_score_visibility_for_player`. El detalle quedó afuera: devolvía
el documento crudo del perfil a cualquiera con sesión, sin mirar si comparte
grupo. Y los `player_id` circulan por todos lados — en las respuestas de torneo,
en las alineaciones, en cualquier pantalla compartida — así que conseguir uno de
otro grupo no requiere hacer nada raro.

Lo que se prueba acá son las dos mitades del agujero:

1. QUIÉN puede pedirlo. Compartir grupo o ser admin, nada más.
2. QUÉ se devuelve. Aunque el pedido sea legítimo, el documento crudo lleva
   `email`, `photo_public_id` y `created_by`, que son contabilidad interna y no
   tienen por qué viajar al front.
"""

from datetime import datetime, timezone
import uuid

import pytest
from fastapi import HTTPException

import routes_players as rp

AHORA = datetime.now(timezone.utc)


async def sembrar_jugador(db, nombre, *, email=None, role="jugador"):
    user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    await db.player_profiles.insert_one({
        "id": profile_id,
        "user_id": user_id,
        "name": nombre,
        "email": email or f"{nombre.lower()}@example.com",
        "player_type": "frecuente",
        "matches_played": 3,
        "birth_date": "1990-05-20",
        "photo_public_id": "futbol-pro/secreto123",
        "photo_url": "https://cdn.example.com/foto.jpg",
        "estimated_level": 7.5,
        "created_by": "alguien",
        "created_at": AHORA.isoformat(),
    })
    return {"user_id": user_id, "role": role}, profile_id


async def sembrar_grupo(db, *miembros):
    group_id = str(uuid.uuid4())
    await db.groups.insert_one({
        "id": group_id,
        "name": "Grupo " + group_id[:4],
        "created_by": miembros[0] if miembros else None,
        "created_at": AHORA.isoformat(),
    })
    for player_id in miembros:
        await db.group_members.insert_one({
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "player_id": player_id,
            "member_role": "frecuente",
            "status": "activo",
            "created_at": AHORA.isoformat(),
        })
    return group_id


@pytest.mark.asyncio
async def test_no_se_puede_ver_a_alguien_de_otro_grupo(mongo_en_memoria):
    db = mongo_en_memoria
    curioso, curioso_id = await sembrar_jugador(db, "Curioso")
    ajeno_user, ajeno_id = await sembrar_jugador(db, "Ajeno")

    await sembrar_grupo(db, curioso_id)
    await sembrar_grupo(db, ajeno_id)

    with pytest.raises(HTTPException) as exc:
        await rp.get_player(ajeno_id, user=curioso)

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_compartir_grupo_alcanza_para_ver_el_detalle(mongo_en_memoria):
    db = mongo_en_memoria
    uno, uno_id = await sembrar_jugador(db, "Uno")
    otro_user, otro_id = await sembrar_jugador(db, "Otro")

    await sembrar_grupo(db, uno_id, otro_id)

    resultado = await rp.get_player(otro_id, user=uno)
    assert resultado["id"] == otro_id
    assert resultado["name"] == "Otro"


@pytest.mark.asyncio
async def test_el_admin_ve_a_cualquiera(mongo_en_memoria):
    db = mongo_en_memoria
    admin, _ = await sembrar_jugador(db, "Jefa", role="admin")
    _, ajeno_id = await sembrar_jugador(db, "Ajeno")
    await sembrar_grupo(db, ajeno_id)

    resultado = await rp.get_player(ajeno_id, user=admin)
    assert resultado["id"] == ajeno_id


@pytest.mark.asyncio
async def test_la_respuesta_no_filtra_contabilidad_interna(mongo_en_memoria):
    """Aunque el pedido sea legítimo, estos campos no viajan.

    `photo_public_id` es el identificador con el que se borra un asset en
    Cloudinary, y `email` es dato personal de otra persona. Ninguno de los dos
    lo usa la pantalla de perfil.
    """
    db = mongo_en_memoria
    uno, uno_id = await sembrar_jugador(db, "Uno")
    _, otro_id = await sembrar_jugador(db, "Otro", email="otro@example.com")
    await sembrar_grupo(db, uno_id, otro_id)

    resultado = await rp.get_player(otro_id, user=uno)

    assert "photo_public_id" not in resultado
    assert "created_by" not in resultado
    assert resultado.get("email") is None


@pytest.mark.asyncio
async def test_sigue_calculando_la_edad(mongo_en_memoria):
    """La edad es lo único derivado que la pantalla sí usa: no se pierde."""
    db = mongo_en_memoria
    uno, uno_id = await sembrar_jugador(db, "Uno")
    _, otro_id = await sembrar_jugador(db, "Otro")
    await sembrar_grupo(db, uno_id, otro_id)

    resultado = await rp.get_player(otro_id, user=uno)
    assert isinstance(resultado.get("age"), int)
    assert resultado["age"] > 20


@pytest.mark.asyncio
async def test_jugador_inexistente_sigue_dando_404(mongo_en_memoria):
    db = mongo_en_memoria
    uno, uno_id = await sembrar_jugador(db, "Uno")
    await sembrar_grupo(db, uno_id)

    with pytest.raises(HTTPException) as exc:
        await rp.get_player("no-existe", user=uno)

    assert exc.value.status_code == 404
