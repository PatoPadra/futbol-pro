from datetime import datetime, timezone, timedelta
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from constants import (
    DEFAULT_MATCH_MODE,
    DEFAULT_MATCH_TYPE,
    MODALITY_CAPACITY,
    capacidades_de,
    modo_disponible,
    modo_label,
    resolver_stats_seguidas,
    stats_de,
)
from database import db
from models import CreateMatchRequest, MatchResponse, RegistrationResponse, UpdateMatchRequest
from services.matches import datos_de_modo, ensure_match_manager, get_match_or_404
from services.permissions import ensure_group_member, ensure_group_organizer
from services.profiles import get_my_profile_or_404

router = APIRouter(prefix="/api/matches", tags=["matches"])


def normalize_registration_type(value: str | None):
    if value in {"organizador", "frecuente", "invitado"}:
        return value
    return None


async def get_membership_map(group_id: str, player_ids: list[str]):
    if not player_ids:
        return {}

    memberships = await db.group_members.find(
        {
            "group_id": group_id,
            "player_id": {"$in": list(set(player_ids))},
            "status": "activo",
        },
        {"_id": 0},
    ).to_list(1000)
    return {membership["player_id"]: membership for membership in memberships}


def infer_registration_type(match: dict, registration: dict | None = None, membership: dict | None = None, profile: dict | None = None):
    explicit = normalize_registration_type((registration or {}).get("registration_type"))
    if explicit:
        return explicit

    player_id = (registration or {}).get("player_id") or (profile or {}).get("id")
    if player_id and player_id == match.get("organizer_id"):
        return "organizador"

    member_role = (membership or {}).get("member_role")
    if member_role == "invitado":
        return "invitado"

    if profile and profile.get("player_type") == "invitado":
        return "invitado"

    return "frecuente"


def resolve_requested_registration_type(requested_type: str | None, *, match: dict, membership: dict | None = None, profile: dict | None = None, allow_organizer: bool = False):
    normalized = normalize_registration_type(requested_type)
    if not normalized:
        return infer_registration_type(match, membership=membership, profile=profile)

    if normalized == "organizador":
        if allow_organizer and profile and profile.get("id") == match.get("organizer_id"):
            return "organizador"
        return infer_registration_type(match, membership=membership, profile=profile)

    return normalized


async def ensure_can_delete_match(match: dict, user):
    if user["role"] == "admin":
        return True

    raise HTTPException(
        status_code=403,
        detail="Solo un admin puede borrar definitivamente un partido",
    )


async def ensure_can_manage_match(match: dict, user):
    if user["role"] == "admin":
        return True

    await ensure_match_manager(match, user)
    return True


def ensure_modo_disponible(mode: str) -> None:
    """Un modo que todavía no tiene sus pantallas no se puede usar.

    El Literal de pydantic acepta los cinco porque los cinco son valores válidos
    y hay partidos que algún día van a tenerlos. Lo que decide si se puede elegir
    HOY es el catálogo.
    """
    if not modo_disponible(mode):
        raise HTTPException(
            status_code=400,
            detail=f'El modo "{modo_label(mode)}" todavía no está disponible',
        )


async def promote_first_substitute(match_id: str):
    first_sup = await db.match_registrations.find_one(
        {"match_id": match_id, "status": "suplente"},
        {"_id": 0},
        sort=[("order", 1)],
    )
    if first_sup:
        await db.match_registrations.update_one(
            {"id": first_sup["id"]},
            {"$set": {"status": "titular"}},
        )


@router.post("", response_model=MatchResponse)
async def create_match(data: CreateMatchRequest, user=Depends(get_current_user)):
    if data.modality not in MODALITY_CAPACITY:
        raise HTTPException(status_code=400, detail="Modalidad inválida (5-11)")

    profile = await get_my_profile_or_404(user)

    group = await db.groups.find_one({"id": data.group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    await ensure_group_organizer(data.group_id, user)
    max_players = MODALITY_CAPACITY[data.modality]
    deadline = f"{data.date}T12:00:00+00:00"
    now = datetime.now(timezone.utc).isoformat()
    match_id = str(uuid.uuid4())

    # El modo se hereda del grupo salvo que el que crea el partido elija otro.
    # Ese orden es el que hace que un grupo no tenga que volver a elegir modo
    # cincuenta y dos veces al año.
    mode = data.mode or group.get("default_match_mode") or DEFAULT_MATCH_MODE
    ensure_modo_disponible(mode)

    # Qué estadísticas sigue el partido sale del modo. En los modos que no las
    # dejan elegir es una constante; en los que sí, lo que haya tildado el
    # organizador. En Diversión y Básico es lista vacía y no hay pestaña que
    # mostrar después.
    tracked_stats = resolver_stats_seguidas(capacidades_de(mode), data.tracked_stats)

    match_doc = {
        "id": match_id,
        "group_id": data.group_id,
        "organizer_id": profile["id"],
        "title": data.title,
        "modality": data.modality,
        "date": data.date,
        "time": data.time,
        "location": data.location,
        "maps_link": data.maps_link,
        "deadline": deadline,
        "status": "abierto",
        "is_recurring": data.is_recurring,
        "max_players": max_players,
        "mode": mode,
        "match_type": data.match_type,
        "tracked_stats": tracked_stats,
        "opponent_name": (data.opponent_name or "").strip() or None,
        "result": None,
        # Quiénes ya tienen este partido sumado en su `matches_played`. Vacío
        # hasta que se finalice (ver sincronizar_partidos_jugados).
        "counted_player_ids": [],
        "created_at": now,
    }
    await db.matches.insert_one(match_doc)

    return MatchResponse(**{
        **{k: v for k, v in match_doc.items() if k != "_id"},
        **datos_de_modo(match_doc, group_name=group["name"]),
        "group_name": group["name"],
        "my_group_role": "organizador",
        "organizer_name": profile["name"],
        "titular_count": 0,
        "suplente_count": 0,
    })


@router.get("")
async def list_matches(
    status: str = Query(None),
    user=Depends(get_current_user),
):
    query = {}
    role_by_group = {}

    if status:
        query["status"] = status

    if user["role"] != "admin":
        profile = await get_my_profile_or_404(user)
        memberships = await db.group_members.find(
            {"player_id": profile["id"], "status": "activo"},
            {"_id": 0},
        ).to_list(500)

        group_ids = [m["group_id"] for m in memberships]
        role_by_group = {m["group_id"]: m["member_role"] for m in memberships}
        query["group_id"] = {"$in": group_ids}

    matches = await db.matches.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    if not matches:
        return []

    group_ids = list({m["group_id"] for m in matches})
    organizer_ids = list({m["organizer_id"] for m in matches})
    match_ids = [m["id"] for m in matches]

    groups = await db.groups.find({"id": {"$in": group_ids}}, {"_id": 0}).to_list(500)
    organizers = await db.player_profiles.find(
        {"id": {"$in": organizer_ids}}, {"_id": 0}
    ).to_list(500)

    count_rows = await db.match_registrations.aggregate([
        {"$match": {"match_id": {"$in": match_ids}, "status": {"$in": ["titular", "suplente"]}}},
        {"$group": {"_id": {"match_id": "$match_id", "status": "$status"}, "count": {"$sum": 1}}},
    ]).to_list(1000)

    group_map = {g["id"]: g for g in groups}
    organizer_map = {p["id"]: p for p in organizers}
    count_map = {(row["_id"]["match_id"], row["_id"]["status"]): row["count"] for row in count_rows}

    result = []
    for match in matches:
        if user["role"] == "admin":
            my_group_role = "admin"
        else:
            my_group_role = role_by_group.get(match["group_id"])

        group_name = group_map.get(match["group_id"], {}).get("name")
        # Se arma el dict y se pasa de una sola vez: `datos_de_modo` devuelve
        # claves que también están en `match` (mode, match_type), y splatear los
        # dos por separado sería un "multiple values for keyword".
        result.append(
            MatchResponse(**{
                **match,
                **datos_de_modo(match, group_name=group_name),
                "group_name": group_name,
                "my_group_role": my_group_role,
                "organizer_name": organizer_map.get(match["organizer_id"], {}).get("name", "Desconocido"),
                "titular_count": count_map.get((match["id"], "titular"), 0),
                "suplente_count": count_map.get((match["id"], "suplente"), 0),
            })
        )

    return result


@router.get("/{match_id}")
async def get_match(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)

    profile = await db.player_profiles.find_one(
        {"user_id": user.get("user_id") or user.get("id")}, {"_id": 0}
    )
    try:
        membership = await ensure_group_member(match["group_id"], user)
    except HTTPException as exc:
        if exc.status_code != 403:
            raise
        await ensure_can_manage_match(match, user)
        membership = {
            "player_id": profile.get("id") if profile else None,
            "member_role": "organizador",
            "status": "activo",
        }

    titular_count = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "titular"}
    )
    suplente_count = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "suplente"}
    )
    organizer = await db.player_profiles.find_one(
        {"id": match["organizer_id"]}, {"_id": 0}
    )
    group = await db.groups.find_one({"id": match["group_id"]}, {"_id": 0})

    my_registration = None
    if profile:
        reg = await db.match_registrations.find_one(
            {"match_id": match_id, "player_id": profile["id"], "status": {"$ne": "baja"}},
            {"_id": 0},
        )
        if reg:
            my_registration = {
                **reg,
                "registration_type": infer_registration_type(match, registration=reg, membership=membership, profile=profile),
            }

    group_name = group["name"] if group else None

    # El nombre del torneo, para que la pantalla pueda decir de dónde viene el
    # resultado. Una consulta más y sólo cuando el partido es de torneo.
    tournament_name = None
    if match.get("tournament_id"):
        torneo = await db.tournaments.find_one(
            {"id": match["tournament_id"]}, {"_id": 0, "name": 1}
        )
        tournament_name = (torneo or {}).get("name")

    return {
        # `counted_player_ids` es contabilidad interna del contador de partidos
        # jugados: no le sirve a nadie del otro lado y sólo agrega ruido.
        **{k: v for k, v in match.items() if k != "counted_player_ids"},
        **datos_de_modo(match, group_name=group_name),
        "group_name": group_name,
        "tournament_name": tournament_name,
        "my_group_role": membership.get("member_role") if user["role"] != "admin" else "admin",
        "organizer_name": organizer["name"] if organizer else "Desconocido",
        "titular_count": titular_count,
        "suplente_count": suplente_count,
        "my_registration": my_registration,
        "can_manage": user["role"] == "admin" or (profile and profile.get("id") == match.get("organizer_id")) or membership.get("member_role") == "organizador",
        "can_delete": user["role"] == "admin",
    }


@router.put("/{match_id}")
async def update_match(
    match_id: str,
    data: UpdateMatchRequest,
    user=Depends(get_current_user),
):
    match = await get_match_or_404(match_id)
    await ensure_can_manage_match(match, user)

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    # Una vez que el partido deja de estar abierto ya hay equipos armados,
    # evaluaciones o estadísticas cargadas bajo las reglas del modo viejo.
    # Cambiarlo a esa altura no reescribe esos datos: sólo deja el historial del
    # jugador contando cosas que no pasaron.
    if "mode" in update_data:
        ensure_modo_disponible(update_data["mode"])

    if "mode" in update_data and match.get("status") != "abierto":
        raise HTTPException(
            status_code=400,
            detail="El modo sólo se puede cambiar mientras la inscripción está abierta",
        )

    # Mismo motivo para las estadísticas: si ya hay filas cargadas, sumar o sacar
    # una columna deja el resto a medio llenar sin forma de distinguir "el
    # jugador no hizo nada" de "esto no se seguía todavía".
    if "tracked_stats" in update_data and match.get("status") != "abierto":
        raise HTTPException(
            status_code=400,
            detail="Las estadísticas a seguir sólo se cambian mientras la inscripción está abierta",
        )

    # Cambiar el modo recalcula qué se sigue, salvo que en el mismo pedido venga
    # una elección explícita. Si no, pasar de Pro a Diversión dejaría un partido
    # sin estadísticas pero con la lista vieja colgada.
    if "mode" in update_data and "tracked_stats" not in update_data:
        update_data["tracked_stats"] = resolver_stats_seguidas(
            capacidades_de(update_data["mode"]), None
        )

    if update_data:
        await db.matches.update_one({"id": match_id}, {"$set": update_data})

    updated = await db.matches.find_one({"id": match_id}, {"_id": 0})
    return updated


@router.delete("/{match_id}")
async def delete_match(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_can_delete_match(match, user)

    await db.match_registrations.delete_many({"match_id": match_id})
    await db.peer_ratings.delete_many({"match_id": match_id})
    await db.self_evaluations.delete_many({"match_id": match_id})
    await db.stats_proposals.delete_many({"match_id": match_id})
    await db.stats_final.delete_many({"match_id": match_id})
    await db.team_generations.delete_many({"match_id": match_id})
    await db.match_outcomes.delete_many({"match_id": match_id})
    await db.player_match_notes.delete_many({"match_id": match_id})
    # El partido se va, pero la llave del torneo queda: su resultado vive ahí.
    await db.matches.delete_one({"id": match_id})

    return {"message": "Partido borrado correctamente"}


@router.post("/{match_id}/register")
async def register_for_match(match_id: str, registration_type: str | None = Query(default=None), user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)

    if match["status"] != "abierto":
        raise HTTPException(status_code=400, detail="El partido no está abierto para inscripción")

    profile = await get_my_profile_or_404(user)
    membership = await ensure_group_member(match["group_id"], user)

    existing = await db.match_registrations.find_one(
        {"match_id": match_id, "player_id": profile["id"], "status": {"$ne": "baja"}},
        {"_id": 0},
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ya estás inscrito en este partido")

    titular_count = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "titular"}
    )
    total_regs = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": {"$ne": "baja"}}
    )

    status = "titular" if titular_count < match["max_players"] else "suplente"
    reg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    resolved_registration_type = resolve_requested_registration_type(
        registration_type,
        match=match,
        membership=membership,
        profile=profile,
        allow_organizer=True,
    )

    reg_doc = {
        "id": reg_id,
        "match_id": match_id,
        "player_id": profile["id"],
        "status": status,
        "registration_type": resolved_registration_type,
        "registered_by": profile["id"],
        "order": total_regs + 1,
        "registered_at": now,
    }
    await db.match_registrations.insert_one(reg_doc)

    return {
        "id": reg_id,
        "status": status,
        "registration_type": resolved_registration_type,
        "message": f"Inscrito como {'titular' if status == 'titular' else 'suplente'}",
    }


@router.post("/{match_id}/register-guest/{guest_id}")
async def register_guest_for_match(match_id: str, guest_id: str, registration_type: str | None = Query(default=None), user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_group_organizer(match["group_id"], user)

    guest = await db.player_profiles.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Jugador invitado no encontrado")
    if match["status"] != "abierto":
        raise HTTPException(status_code=400, detail="El partido no está abierto para inscripción")

    guest_membership = await db.group_members.find_one(
        {
            "group_id": match["group_id"],
            "player_id": guest_id,
            "status": "activo",
        },
        {"_id": 0},
    )
    if not guest_membership:
        raise HTTPException(status_code=400, detail="El invitado no pertenece al grupo del partido")

    existing = await db.match_registrations.find_one(
        {"match_id": match_id, "player_id": guest_id, "status": {"$ne": "baja"}},
        {"_id": 0},
    )
    if existing:
        raise HTTPException(status_code=400, detail="El jugador ya está inscrito")

    titular_count = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "titular"}
    )
    total_regs = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": {"$ne": "baja"}}
    )

    status = "titular" if titular_count < match["max_players"] else "suplente"
    reg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    resolved_registration_type = resolve_requested_registration_type(
        registration_type,
        match=match,
        membership=guest_membership,
        profile=guest,
        allow_organizer=False,
    )

    reg_doc = {
        "id": reg_id,
        "match_id": match_id,
        "player_id": guest_id,
        "status": status,
        "registration_type": resolved_registration_type,
        "registered_by": (await get_my_profile_or_404(user))["id"],
        "order": total_regs + 1,
        "registered_at": now,
    }
    await db.match_registrations.insert_one(reg_doc)
    return {"id": reg_id, "status": status, "registration_type": resolved_registration_type}


@router.delete("/{match_id}/register")
async def unregister_from_match(match_id: str, user=Depends(get_current_user)):
    profile = await get_my_profile_or_404(user)

    reg = await db.match_registrations.find_one(
        {"match_id": match_id, "player_id": profile["id"], "status": {"$ne": "baja"}},
        {"_id": 0},
    )
    if not reg:
        raise HTTPException(status_code=400, detail="No estás inscrito en este partido")

    was_titular = reg["status"] == "titular"
    await db.match_registrations.update_one(
        {"id": reg["id"]}, {"$set": {"status": "baja"}}
    )

    if was_titular:
        await promote_first_substitute(match_id)

    return {"message": "Te has dado de baja del partido"}


@router.get("/{match_id}/registrations")
async def get_registrations(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    try:
        await ensure_group_member(match["group_id"], user)
    except HTTPException as exc:
        if exc.status_code != 403:
            raise
        await ensure_can_manage_match(match, user)

    regs = await db.match_registrations.find(
        {"match_id": match_id, "status": {"$ne": "baja"}},
        {"_id": 0},
    ).sort("order", 1).to_list(100)

    if not regs:
        return []

    player_ids = [reg["player_id"] for reg in regs]
    profiles = await db.player_profiles.find({"id": {"$in": player_ids}}, {"_id": 0}).to_list(200)
    profile_map = {profile["id"]: profile for profile in profiles}
    membership_map = await get_membership_map(match["group_id"], player_ids)

    result = []
    for reg in regs:
        profile = profile_map.get(reg["player_id"])
        if profile:
            membership = membership_map.get(reg["player_id"])
            result.append(
                RegistrationResponse(
                    id=reg["id"],
                    match_id=reg["match_id"],
                    player_id=reg["player_id"],
                    player_name=profile["name"],
                    player_photo=profile.get("photo_url"),
                    player_gender=profile.get("gender"),
                    primary_position=profile.get("primary_position"),
                    status=reg["status"],
                    registration_type=infer_registration_type(match, registration=reg, membership=membership, profile=profile),
                    registered_by=reg.get("registered_by"),
                    attendance=reg.get("attendance"),
                    order=reg["order"],
                    registered_at=reg["registered_at"],
                )
            )
    return result


@router.post("/{match_id}/close")
async def close_registrations(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_can_manage_match(match, user)

    await db.matches.update_one(
        {"id": match_id}, {"$set": {"status": "cerrado"}}
    )
    return {"message": "Inscripciones cerradas"}


@router.post("/{match_id}/cancel")
async def cancel_match(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_can_manage_match(match, user)

    if match["status"] in ["finalizado", "completado"]:
        raise HTTPException(status_code=400, detail="No puedes cancelar un partido ya finalizado")
    if match["status"] == "cancelado":
        raise HTTPException(status_code=400, detail="El partido ya está cancelado")

    await db.matches.update_one(
        {"id": match_id},
        {"$set": {"status": "cancelado"}},
    )
    return {"message": "Partido cancelado correctamente"}


@router.delete("/{match_id}/registrations/{registration_id}")
async def remove_registration(match_id: str, registration_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_can_manage_match(match, user)

    if match["status"] in ["finalizado", "completado", "cancelado"]:
        raise HTTPException(status_code=400, detail="No puedes quitar jugadores en este estado del partido")

    registration = await db.match_registrations.find_one(
        {"id": registration_id, "match_id": match_id, "status": {"$ne": "baja"}},
        {"_id": 0},
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")

    actor = await get_my_profile_or_404(user)
    was_titular = registration.get("status") == "titular"
    await db.match_registrations.update_one(
        {"id": registration_id},
        {"$set": {"status": "baja", "removed_by": actor["id"], "removed_at": datetime.now(timezone.utc).isoformat(), "removed_reason": "removed_by_manager"}},
    )

    if was_titular:
        await promote_first_substitute(match_id)

    message = "Jugador quitado del partido"
    if match.get("status") in ["equipos_generados", "equipos_confirmados"]:
        await db.team_generations.delete_many({"match_id": match_id})
        await db.matches.update_one(
            {"id": match_id},
            {"$set": {"status": "cerrado"}},
        )
        message = "Jugador quitado del partido y equipos reiniciados"

    return {"message": message, "registration_id": registration_id}


@router.post("/{match_id}/duplicate")
async def duplicate_match(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_can_manage_match(match, user)
    profile = await get_my_profile_or_404(user)

    try:
        original_date = datetime.strptime(match["date"], "%Y-%m-%d")
        next_date = original_date + timedelta(days=7)
        next_date_str = next_date.strftime("%Y-%m-%d")
    except ValueError:
        next_date_str = match["date"]

    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    deadline = f"{next_date_str}T12:00:00+00:00"

    new_match = {
        "id": new_id,
        "group_id": match["group_id"],
        "organizer_id": profile["id"],
        "title": match["title"],
        "modality": match["modality"],
        "date": next_date_str,
        "time": match["time"],
        "location": match["location"],
        "maps_link": match.get("maps_link"),
        "deadline": deadline,
        "status": "abierto",
        "is_recurring": True,
        "max_players": match["max_players"],
        # El duplicado es "la fecha que viene de lo mismo": si heredara el modo
        # por default en vez del original, un grupo en modo Diversión que duplica
        # su partido semanal se encontraría de golpe pidiendo evaluaciones.
        "mode": match.get("mode") or DEFAULT_MATCH_MODE,
        "match_type": match.get("match_type") or DEFAULT_MATCH_TYPE,
        "tracked_stats": stats_de(match),
        # El rival se hereda: el duplicado es la revancha de la semana que viene
        # con el mismo equipo, y si hay que cambiarlo se cambia a mano.
        "opponent_name": match.get("opponent_name"),
        "result": None,
        "counted_player_ids": [],
        "created_at": now,
    }
    await db.matches.insert_one(new_match)

    return {"id": new_id, "message": f"Partido duplicado para {next_date_str}"}
