"""
Tests de la autorización por grupo.

`services/permissions.py` es la autorización de media app y no tenía una sola
prueba. Sus seis funciones `ensure_*` deciden quién administra un grupo, quién
invita, quién califica y quién borra, y `score_visibility` decide quién ve los
puntajes de quién.

Lo que se fija acá, además de lo obvio:

1. **Que el eje sea el rol DE GRUPO y no el global.** Alguien puede organizar un
   grupo y ser jugador común en otro. El backend siempre lo resolvió bien; lo
   que faltaba era una prueba que lo dejara escrito, porque el front leyó el eje
   equivocado durante mucho tiempo justamente porque los dos usan la palabra
   "organizador".

2. **La asimetría del organizador del partido.** Quien creó un partido lo
   administra aunque no sea organizador del grupo. Es una regla real que el
   front contradecía.

3. **Que borrar el grupo sea más restrictivo que administrarlo.** Un organizador
   ascendido puede hacer todo menos destruir la casa: eso queda para quien la
   creó.
"""

from datetime import datetime, timezone
import uuid

import pytest
from fastapi import HTTPException

from services.matches import ensure_match_manager
from services.permissions import (
    ensure_can_delete_group,
    ensure_can_invite_to_group,
    ensure_can_manage_group,
    ensure_can_rate_group,
    ensure_group_member,
    ensure_group_organizer,
)
from services.score_visibility import get_score_visibility_for_group

AHORA = datetime.now(timezone.utc)


async def sembrar_jugador(db, nombre, *, role="jugador"):
    user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    await db.player_profiles.insert_one({
        "id": profile_id, "user_id": user_id, "name": nombre,
        "player_type": "frecuente", "matches_played": 0,
        "created_at": AHORA.isoformat(),
    })
    return {"user_id": user_id, "role": role}, profile_id


async def sembrar_grupo(db, creador_id, miembros):
    """`miembros` es {player_id: member_role}."""
    group_id = str(uuid.uuid4())
    await db.groups.insert_one({
        "id": group_id, "name": "Los del martes",
        "created_by": creador_id, "created_at": AHORA.isoformat(),
    })
    for player_id, rol in miembros.items():
        await db.group_members.insert_one({
            "id": str(uuid.uuid4()), "group_id": group_id, "player_id": player_id,
            "member_role": rol, "status": "activo", "created_at": AHORA.isoformat(),
        })
    return group_id


# --------------------------------------------------------------------- #
# Pertenencia
# --------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_el_que_no_es_del_grupo_no_pasa(mongo_en_memoria):
    db = mongo_en_memoria
    ajeno, ajeno_id = await sembrar_jugador(db, "Ajeno")
    _, duenio_id = await sembrar_jugador(db, "Dueño")
    group_id = await sembrar_grupo(db, duenio_id, {duenio_id: "organizador"})

    with pytest.raises(HTTPException) as exc:
        await ensure_group_member(group_id, ajeno)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_el_admin_entra_a_cualquier_grupo_como_organizador(mongo_en_memoria):
    db = mongo_en_memoria
    admin, _ = await sembrar_jugador(db, "Jefa", role="admin")
    _, duenio_id = await sembrar_jugador(db, "Dueño")
    group_id = await sembrar_grupo(db, duenio_id, {duenio_id: "organizador"})

    membresia = await ensure_group_member(group_id, admin)
    assert membresia["member_role"] == "organizador"


@pytest.mark.asyncio
async def test_una_membresia_inactiva_no_alcanza(mongo_en_memoria):
    db = mongo_en_memoria
    ex, ex_id = await sembrar_jugador(db, "Ex")
    _, duenio_id = await sembrar_jugador(db, "Dueño")
    group_id = await sembrar_grupo(db, duenio_id, {duenio_id: "organizador"})
    await db.group_members.insert_one({
        "id": str(uuid.uuid4()), "group_id": group_id, "player_id": ex_id,
        "member_role": "frecuente", "status": "inactivo", "created_at": AHORA.isoformat(),
    })

    with pytest.raises(HTTPException) as exc:
        await ensure_group_member(group_id, ex)
    assert exc.value.status_code == 403


# --------------------------------------------------------------------- #
# Qué habilita cada rol de grupo
# --------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_el_frecuente_no_administra_ni_invita(mongo_en_memoria):
    db = mongo_en_memoria
    jugador, jugador_id = await sembrar_jugador(db, "Jugador")
    _, duenio_id = await sembrar_jugador(db, "Dueño")
    group_id = await sembrar_grupo(db, duenio_id, {
        duenio_id: "organizador", jugador_id: "frecuente",
    })

    for guarda in (ensure_group_organizer, ensure_can_manage_group, ensure_can_invite_to_group):
        with pytest.raises(HTTPException) as exc:
            await guarda(group_id, jugador)
        assert exc.value.status_code == 403, guarda.__name__


@pytest.mark.asyncio
async def test_el_frecuente_si_puede_calificar(mongo_en_memoria):
    db = mongo_en_memoria
    jugador, jugador_id = await sembrar_jugador(db, "Jugador")
    _, duenio_id = await sembrar_jugador(db, "Dueño")
    group_id = await sembrar_grupo(db, duenio_id, {
        duenio_id: "organizador", jugador_id: "frecuente",
    })

    membresia = await ensure_can_rate_group(group_id, jugador)
    assert membresia["member_role"] == "frecuente"


@pytest.mark.asyncio
async def test_el_invitado_no_califica(mongo_en_memoria):
    db = mongo_en_memoria
    invitado, invitado_id = await sembrar_jugador(db, "Invitado")
    _, duenio_id = await sembrar_jugador(db, "Dueño")
    group_id = await sembrar_grupo(db, duenio_id, {
        duenio_id: "organizador", invitado_id: "invitado",
    })

    with pytest.raises(HTTPException) as exc:
        await ensure_can_rate_group(group_id, invitado)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_el_organizador_de_grupo_administra_aunque_su_rol_global_sea_jugador(mongo_en_memoria):
    """El corazón del asunto: el eje que manda es el rol DE GRUPO.

    `user["role"]` es "jugador" y aun así administra, invita y califica, porque
    en ESTE grupo es organizador.
    """
    db = mongo_en_memoria
    organizador, organizador_id = await sembrar_jugador(db, "Orga", role="jugador")
    group_id = await sembrar_grupo(db, organizador_id, {organizador_id: "organizador"})

    for guarda in (
        ensure_group_organizer, ensure_can_manage_group,
        ensure_can_invite_to_group, ensure_can_rate_group,
    ):
        membresia = await guarda(group_id, organizador)
        assert membresia["member_role"] == "organizador", guarda.__name__


@pytest.mark.asyncio
async def test_se_puede_organizar_un_grupo_y_ser_jugador_comun_en_otro(mongo_en_memoria):
    db = mongo_en_memoria
    persona, persona_id = await sembrar_jugador(db, "Pato")
    _, otro_duenio_id = await sembrar_jugador(db, "Otro")

    propio = await sembrar_grupo(db, persona_id, {persona_id: "organizador"})
    ajeno = await sembrar_grupo(db, otro_duenio_id, {
        otro_duenio_id: "organizador", persona_id: "frecuente",
    })

    await ensure_group_organizer(propio, persona)

    with pytest.raises(HTTPException) as exc:
        await ensure_group_organizer(ajeno, persona)
    assert exc.value.status_code == 403


# --------------------------------------------------------------------- #
# Borrar es más restrictivo que administrar
# --------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_un_organizador_ascendido_no_puede_borrar_el_grupo(mongo_en_memoria):
    db = mongo_en_memoria
    ascendido, ascendido_id = await sembrar_jugador(db, "Ascendido")
    _, fundador_id = await sembrar_jugador(db, "Fundador")
    group_id = await sembrar_grupo(db, fundador_id, {
        fundador_id: "organizador", ascendido_id: "organizador",
    })

    await ensure_can_manage_group(group_id, ascendido)

    with pytest.raises(HTTPException) as exc:
        await ensure_can_delete_group(group_id, ascendido)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_el_que_creo_el_grupo_si_puede_borrarlo(mongo_en_memoria):
    db = mongo_en_memoria
    fundador, fundador_id = await sembrar_jugador(db, "Fundador")
    group_id = await sembrar_grupo(db, fundador_id, {fundador_id: "organizador"})

    grupo = await ensure_can_delete_group(group_id, fundador)
    assert grupo["id"] == group_id


# --------------------------------------------------------------------- #
# La asimetría del organizador del partido
# --------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_el_organizador_del_partido_lo_administra_sin_ser_organizador_del_grupo(mongo_en_memoria):
    """Una regla real que el front contradecía.

    `utils/permissions.js` preguntaba sólo por el rol de grupo, así que quien
    había creado el partido no veía los botones de su propio partido.
    """
    db = mongo_en_memoria
    creador, creador_id = await sembrar_jugador(db, "Creador")
    _, duenio_id = await sembrar_jugador(db, "Dueño")
    group_id = await sembrar_grupo(db, duenio_id, {
        duenio_id: "organizador", creador_id: "frecuente",
    })
    match = {
        "id": str(uuid.uuid4()), "group_id": group_id, "organizer_id": creador_id,
        "title": "Mi partido", "modality": 5, "date": "2026-09-05",
        "mode": "avanzado", "status": "abierto",
    }
    await db.matches.insert_one(match)

    concedido = await ensure_match_manager(match, creador)
    assert concedido["granted_by"] == "match_organizer"


@pytest.mark.asyncio
async def test_un_frecuente_cualquiera_no_administra_el_partido_de_otro(mongo_en_memoria):
    db = mongo_en_memoria
    _, creador_id = await sembrar_jugador(db, "Creador")
    curioso, curioso_id = await sembrar_jugador(db, "Curioso")
    group_id = await sembrar_grupo(db, creador_id, {
        creador_id: "organizador", curioso_id: "frecuente",
    })
    match = {
        "id": str(uuid.uuid4()), "group_id": group_id, "organizer_id": creador_id,
        "title": "Partido ajeno", "modality": 5, "date": "2026-09-05",
        "mode": "avanzado", "status": "abierto",
    }
    await db.matches.insert_one(match)

    with pytest.raises(HTTPException) as exc:
        await ensure_match_manager(match, curioso)
    assert exc.value.status_code == 403


# --------------------------------------------------------------------- #
# Visibilidad de puntajes
# --------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_el_organizador_ve_los_puntajes_de_su_grupo(mongo_en_memoria):
    db = mongo_en_memoria
    organizador, organizador_id = await sembrar_jugador(db, "Orga")
    group_id = await sembrar_grupo(db, organizador_id, {organizador_id: "organizador"})

    visibilidad = await get_score_visibility_for_group(group_id, organizador)
    assert visibilidad["can_view_peer_scores"] is True


@pytest.mark.asyncio
async def test_un_frecuente_no_ve_los_puntajes_del_grupo(mongo_en_memoria):
    db = mongo_en_memoria
    jugador, jugador_id = await sembrar_jugador(db, "Jugador")
    _, duenio_id = await sembrar_jugador(db, "Dueño")
    group_id = await sembrar_grupo(db, duenio_id, {
        duenio_id: "organizador", jugador_id: "frecuente",
    })

    visibilidad = await get_score_visibility_for_group(group_id, jugador)
    assert visibilidad["can_view_peer_scores"] is False


@pytest.mark.asyncio
async def test_organizar_un_grupo_no_deja_ver_los_puntajes_de_otro(mongo_en_memoria):
    """El caso que combina los dos ejes y es el más fácil de romper."""
    db = mongo_en_memoria
    persona, persona_id = await sembrar_jugador(db, "Pato")
    _, otro_duenio_id = await sembrar_jugador(db, "Otro")

    await sembrar_grupo(db, persona_id, {persona_id: "organizador"})
    ajeno = await sembrar_grupo(db, otro_duenio_id, {
        otro_duenio_id: "organizador", persona_id: "frecuente",
    })

    visibilidad = await get_score_visibility_for_group(ajeno, persona)
    assert visibilidad["can_view_peer_scores"] is False
