from fastapi import HTTPException

from constants import (
    DEFAULT_MATCH_MODE,
    DEFAULT_MATCH_TYPE,
    capacidades_de,
    jugo_el_partido,
    modo_label,
    stats_de,
    tipo_label,
)
from database import db
from services.profiles import get_my_profile_or_404


def etiquetas_de_lados(match: dict, capacidades: dict, group_name: str | None = None) -> dict:
    """Cómo se llaman los dos lados del marcador.

    Con rival externo (modo Entrenador) el local somos nosotros y el visitante
    es el rival. En todos los demás modos es el clásico A contra B.

    Vive en el backend y no en la pantalla del resultado para que esa pantalla
    no tenga que saber nada del modo: pide dos etiquetas y dos números.
    """
    if capacidades.get("opponent") == "externo":
        return {
            "home_label": group_name or match.get("group_name") or "Nuestro equipo",
            "away_label": match.get("opponent_name") or "Rival",
        }
    return {"home_label": "Equipo A", "away_label": "Equipo B"}


def datos_de_modo(match: dict, group_name: str | None = None) -> dict:
    """Los campos derivados del modo, resueltos en un solo lugar.

    Las cuatro rutas que devuelven un partido (crear, listar, detalle,
    duplicar) los necesitan idénticos. Sin esto, el día que cambie una etiqueta
    hay que acordarse de los cuatro — y del que se agregue después.

    Un partido viejo sin `mode` cae al default, que es exactamente lo que la app
    hacía antes de que los modos existieran.
    """
    mode = match.get("mode") or DEFAULT_MATCH_MODE
    match_type = match.get("match_type") or DEFAULT_MATCH_TYPE
    capacidades = capacidades_de(mode)
    return {
        "mode": mode,
        "mode_label": modo_label(mode),
        "match_type": match_type,
        "match_type_label": tipo_label(match_type),
        "capabilities": capacidades,
        "tracked_stats": stats_de(match),
        **etiquetas_de_lados(match, capacidades, group_name),
    }


async def sincronizar_partidos_jugados(match_id: str) -> list[str]:
    """Deja `matches_played` consistente con la asistencia de este partido.

    El contador es acumulado entre partidos, así que para poder corregirlo hay
    que saber qué aportó ESTE partido: para eso está `counted_player_ids`. Se
    calcula quiénes jugaron, se compara contra los que ya estaban contados y se
    aplica sólo la diferencia.

    Es idempotente por construcción. Antes el conteo vivía suelto adentro de
    `finalize_match` como un `$inc` por jugador, así que finalizar dos veces —
    un doble click alcanzaba — le sumaba dos partidos a cada uno, y ese contador
    es el que alimenta el índice de confianza del rating.

    El `matches_played > 0` del decremento es una red: si por lo que sea el
    contador ya estaba en cero, no lo dejamos en negativo.
    """
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        return []

    registrations = await db.match_registrations.find(
        {"match_id": match_id, "status": {"$ne": "baja"}},
        {"_id": 0},
    ).to_list(500)

    jugaron = {reg["player_id"] for reg in registrations if jugo_el_partido(reg)}

    contados_guardados = match.get("counted_player_ids")
    if contados_guardados is None and match.get("status") in ("finalizado", "completado"):
        # Partido finalizado ANTES de que existiera este contador: el código
        # viejo ya le sumó el partido a los titulares. Si asumiéramos que no
        # contó a nadie, la primera vez que alguien tocara su asistencia les
        # sumaría el partido de nuevo a todos. Reconstruimos el conjunto exacto
        # que aquel código habría contado.
        #
        # La migración de arranque hace lo mismo (ver backfill_match_defaults),
        # pero esto no depende de que haya corrido: es un dato que si se rompe
        # se rompe callado, así que va cubierto de los dos lados.
        contados = {reg["player_id"] for reg in registrations if reg.get("status") == "titular"}
    else:
        contados = set(contados_guardados or [])

    nuevos = jugaron - contados
    salieron = contados - jugaron

    if nuevos:
        await db.player_profiles.update_many(
            {"id": {"$in": sorted(nuevos)}},
            {"$inc": {"matches_played": 1}},
        )
    if salieron:
        await db.player_profiles.update_many(
            {"id": {"$in": sorted(salieron)}, "matches_played": {"$gt": 0}},
            {"$inc": {"matches_played": -1}},
        )

    await db.matches.update_one(
        {"id": match_id},
        {"$set": {"counted_player_ids": sorted(jugaron)}},
    )
    return sorted(jugaron)


async def get_match_or_404(match_id: str):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    return match


async def ensure_match_manager(match: dict, user, *, allow_group_organizer: bool = True):
    if user["role"] == "admin":
        return {"granted_by": "admin"}

    profile = await get_my_profile_or_404(user)
    if profile["id"] == match.get("organizer_id"):
        return {"granted_by": "match_organizer", "profile": profile}

    if allow_group_organizer:
        membership = await db.group_members.find_one(
            {
                "group_id": match["group_id"],
                "player_id": profile["id"],
                "status": "activo",
            },
            {"_id": 0},
        )
        if membership and membership.get("member_role") == "organizador":
            return {"granted_by": "group_organizer", "profile": profile, "membership": membership}

    raise HTTPException(
        status_code=403,
        detail="Solo el organizador del partido o un admin puede hacer esta acción",
    )


async def ensure_match_participant(match_id: str, user):
    match = await get_match_or_404(match_id)
    profile = await get_my_profile_or_404(user)

    registration = await db.match_registrations.find_one(
        {"match_id": match_id, "player_id": profile["id"], "status": {"$ne": "baja"}},
        {"_id": 0},
    )
    if not registration:
        raise HTTPException(status_code=403, detail="Solo participantes del partido pueden hacer esta acción")

    return match, profile, registration
