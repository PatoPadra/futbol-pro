"""
Tests del alta abierta: cualquiera arma su grupo, y se entra por link.

El callejón sin salida del onboarding no era un problema de copy: crear grupo
exigía el rol global de organizador, que sólo un admin otorgaba a mano. El que
se registraba por su cuenta completaba todo el alta —foto, nombre, nacimiento,
género, posiciones— y aterrizaba en un panel que le decía "cuando tu organizador
arme la próxima fecha te va a aparecer acá", sin tener organizador.

Con el alta abierta eso se resuelve solo: quien llega crea su grupo. Y para el
que SÍ tiene a alguien que lo invite, ahora hay un link — el mismo mecanismo con
el que ya se comparte el partido por WhatsApp.

Lo que se fija acá:

1. Crear grupo no pide nada, y quien lo crea queda como organizador DE ESE
   GRUPO (no como organizador global, que ya no existe).
2. El link entra sin aprobación, pero SIEMPRE como `frecuente`: un link
   filtrado no puede regalar la administración del grupo.
3. Rotar el link mata el anterior de verdad.
4. Los torneos pasaron a depender del rol de grupo.
"""

from datetime import datetime, timezone
import uuid

import pytest
from fastapi import HTTPException

import routes_groups as rg
import routes_invitations as ri
import routes_tournaments as rt
from models import CreateGroupRequest, CreateTournamentRequest

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


async def membresia(db, group_id, player_id):
    return await db.group_members.find_one(
        {"group_id": group_id, "player_id": player_id}, {"_id": 0}
    )


# --------------------------------------------------------------------- #
# Crear grupo
# --------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_un_jugador_comun_puede_crear_su_grupo(mongo_en_memoria):
    """Antes esto era un 403 y era el callejón sin salida del onboarding."""
    db = mongo_en_memoria
    user, profile_id = await sembrar_jugador(db, "Recién llegado", role="jugador")

    grupo = await rg.create_group(CreateGroupRequest(name="Los del martes"), user=user)

    assert grupo["name"] == "Los del martes"
    mia = await membresia(db, grupo["id"], profile_id)
    assert mia["member_role"] == "organizador"


@pytest.mark.asyncio
async def test_crear_grupo_no_toca_el_rol_global(mongo_en_memoria):
    """Es organizador DE SU GRUPO, no de la app."""
    db = mongo_en_memoria
    user, _ = await sembrar_jugador(db, "Pato", role="jugador")

    await rg.create_group(CreateGroupRequest(name="Los del martes"), user=user)

    usuario = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    assert usuario is None or usuario.get("role") != "organizador"


# --------------------------------------------------------------------- #
# El link de invitación
# --------------------------------------------------------------------- #

async def grupo_con_link(db):
    organizador, org_id = await sembrar_jugador(db, "Orga")
    grupo = await rg.create_group(CreateGroupRequest(name="Los del martes"), user=organizador)
    link = await rg.crear_link_de_invitacion(grupo["id"], user=organizador)
    return organizador, org_id, grupo, link["token"]


@pytest.mark.asyncio
async def test_el_link_suma_al_grupo_sin_aprobacion(mongo_en_memoria):
    db = mongo_en_memoria
    _, _, grupo, token = await grupo_con_link(db)
    recien, recien_id = await sembrar_jugador(db, "Recién llegado")

    resultado = await ri.aceptar_invitacion(token, user=recien)

    assert resultado["group_id"] == grupo["id"]
    assert resultado["ya_estaba"] is False
    mia = await membresia(db, grupo["id"], recien_id)
    assert mia["status"] == "activo"


@pytest.mark.asyncio
async def test_quien_entra_por_link_nunca_es_organizador(mongo_en_memoria):
    """Un link filtrado no puede regalar la administración del grupo."""
    db = mongo_en_memoria
    _, _, grupo, token = await grupo_con_link(db)
    recien, recien_id = await sembrar_jugador(db, "Recién llegado")

    await ri.aceptar_invitacion(token, user=recien)

    mia = await membresia(db, grupo["id"], recien_id)
    assert mia["member_role"] == "frecuente"


@pytest.mark.asyncio
async def test_ver_la_invitacion_dice_a_que_grupo_es(mongo_en_memoria):
    """Nadie entra a ciegas: el link dice el grupo y quién invita."""
    db = mongo_en_memoria
    _, _, grupo, token = await grupo_con_link(db)
    recien, _ = await sembrar_jugador(db, "Recién llegado")

    vista = await ri.ver_invitacion(token, user=recien)

    assert vista.group_name == "Los del martes"
    assert vista.invitado_por == "Orga"
    assert vista.ya_soy_miembro is False
    assert vista.miembros == 1


@pytest.mark.asyncio
async def test_si_ya_soy_miembro_lo_dice_en_vez_de_ofrecer_entrar(mongo_en_memoria):
    db = mongo_en_memoria
    organizador, _, grupo, token = await grupo_con_link(db)

    vista = await ri.ver_invitacion(token, user=organizador)

    assert vista.ya_soy_miembro is True


@pytest.mark.asyncio
async def test_aceptar_dos_veces_no_duplica_la_membresia(mongo_en_memoria):
    """El doble tap no puede crear dos filas: hay un índice único sobre el par."""
    db = mongo_en_memoria
    _, _, grupo, token = await grupo_con_link(db)
    recien, recien_id = await sembrar_jugador(db, "Recién llegado")

    await ri.aceptar_invitacion(token, user=recien)
    segunda = await ri.aceptar_invitacion(token, user=recien)

    assert segunda["ya_estaba"] is True
    cuantas = await db.group_members.count_documents(
        {"group_id": grupo["id"], "player_id": recien_id}
    )
    assert cuantas == 1


@pytest.mark.asyncio
async def test_el_que_se_habia_ido_vuelve_reactivando_su_membresia(mongo_en_memoria):
    """Y no insertando otra, que además chocaría con el índice único."""
    db = mongo_en_memoria
    _, _, grupo, token = await grupo_con_link(db)
    vuelve, vuelve_id = await sembrar_jugador(db, "El que volvió")

    await ri.aceptar_invitacion(token, user=vuelve)
    await db.group_members.update_one(
        {"group_id": grupo["id"], "player_id": vuelve_id},
        {"$set": {"status": "inactivo"}},
    )
    await ri.aceptar_invitacion(token, user=vuelve)

    cuantas = await db.group_members.count_documents(
        {"group_id": grupo["id"], "player_id": vuelve_id}
    )
    assert cuantas == 1
    mia = await membresia(db, grupo["id"], vuelve_id)
    assert mia["status"] == "activo"


@pytest.mark.asyncio
async def test_rotar_el_link_mata_el_anterior(mongo_en_memoria):
    """Es lo que se hace cuando el link se filtró."""
    db = mongo_en_memoria
    organizador, _, grupo, viejo = await grupo_con_link(db)

    nuevo = await rg.crear_link_de_invitacion(grupo["id"], rotar=True, user=organizador)
    assert nuevo["token"] != viejo

    recien, _ = await sembrar_jugador(db, "Con el link viejo")
    with pytest.raises(HTTPException) as exc:
        await ri.aceptar_invitacion(viejo, user=recien)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_pedir_el_link_dos_veces_devuelve_el_mismo(mongo_en_memoria):
    """Sin `rotar` no se emite uno nuevo: un solo link vivo por grupo."""
    db = mongo_en_memoria
    organizador, _, grupo, primero = await grupo_con_link(db)

    segundo = await rg.crear_link_de_invitacion(grupo["id"], user=organizador)

    assert segundo["token"] == primero


@pytest.mark.asyncio
async def test_revocar_deja_el_grupo_cerrado(mongo_en_memoria):
    db = mongo_en_memoria
    organizador, _, grupo, token = await grupo_con_link(db)

    await rg.revocar_link_de_invitacion(grupo["id"], user=organizador)

    recien, _ = await sembrar_jugador(db, "Tarde")
    with pytest.raises(HTTPException) as exc:
        await ri.aceptar_invitacion(token, user=recien)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_un_miembro_comun_no_puede_generar_el_link(mongo_en_memoria):
    """Invitar es cosa del organizador del grupo."""
    db = mongo_en_memoria
    _, _, grupo, token = await grupo_con_link(db)
    comun, _ = await sembrar_jugador(db, "Común")
    await ri.aceptar_invitacion(token, user=comun)

    with pytest.raises(HTTPException) as exc:
        await rg.crear_link_de_invitacion(grupo["id"], user=comun)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_un_token_inventado_no_entra_a_ningun_lado(mongo_en_memoria):
    db = mongo_en_memoria
    curioso, _ = await sembrar_jugador(db, "Curioso")

    with pytest.raises(HTTPException) as exc:
        await ri.aceptar_invitacion("no-existe-este-token", user=curioso)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_el_token_no_es_el_id_del_grupo(mongo_en_memoria):
    """Si lo fuera, cualquiera que viera un group_id se metería solo."""
    db = mongo_en_memoria
    _, _, grupo, token = await grupo_con_link(db)

    assert token != grupo["id"]
    assert len(token) >= 20


@pytest.mark.asyncio
async def test_borrar_el_grupo_se_lleva_sus_invitaciones(mongo_en_memoria):
    db = mongo_en_memoria
    organizador, _, grupo, _ = await grupo_con_link(db)

    await rg.delete_group(grupo["id"], user=organizador)

    quedan = await db.group_invitations.count_documents({"group_id": grupo["id"]})
    assert quedan == 0


# --------------------------------------------------------------------- #
# Torneos: por rol de grupo
# --------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_el_que_organiza_un_grupo_puede_crear_torneo(mongo_en_memoria):
    db = mongo_en_memoria
    organizador, _ = await sembrar_jugador(db, "Orga", role="jugador")
    await rg.create_group(CreateGroupRequest(name="Los del martes"), user=organizador)

    torneo = await rt.create_tournament(
        CreateTournamentRequest(name="Copa de invierno", format="liga"), user=organizador
    )
    assert torneo["name"] == "Copa de invierno"


@pytest.mark.asyncio
async def test_el_que_no_organiza_ningun_grupo_no_puede(mongo_en_memoria):
    db = mongo_en_memoria
    suelto, _ = await sembrar_jugador(db, "Suelto", role="jugador")

    with pytest.raises(HTTPException) as exc:
        await rt.create_tournament(
            CreateTournamentRequest(name="Copa de invierno", format="liga"), user=suelto
        )
    assert exc.value.status_code == 403
