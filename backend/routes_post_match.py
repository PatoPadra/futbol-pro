from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from constants import TRACKABLE_STAT_MAP, capacidades_de, stats_de, valores_de_stats
from database import db
from models import (
    PeerRatingBatchRequest,
    SelfEvaluationRequest,
    SetAttendanceRequest,
    SetMatchResultRequest,
    SetMatchStatsRequest,
    StatsProposalRequest,
    StatsVoteRequest,
)
from services.fixture_results import aplicar_resultado, orientar
from services.match_outcomes import recalcular_outcomes
from services.matches import (
    ensure_match_manager,
    ensure_match_participant,
    get_match_or_404,
    sincronizar_partidos_jugados,
)
from services.permissions import ensure_group_member, ensure_group_organizer
from services.profiles import get_my_profile_or_404
from services.score_visibility import get_score_visibility_for_group

router = APIRouter(prefix="/api/matches", tags=["post-match"])


def _ensure_evalua_por_partido(match: dict) -> None:
    """Las evaluaciones entre pares sólo existen en los modos que las piden.

    Se valida en el endpoint y no sólo en la pantalla: si únicamente
    escondiéramos la pestaña, un partido de Diversión igual podría terminar con
    evaluaciones cargadas a mano, y esas evaluaciones mueven el puntaje de los
    jugadores para siempre.
    """
    if not capacidades_de(match.get("mode")).get("rating_por_partido"):
        raise HTTPException(
            status_code=400,
            detail="En este modo no se evalúa a los jugadores",
        )


def _ensure_stats_por(match: dict, origen_esperado: str) -> None:
    """Que las estadísticas se carguen por donde el modo dice que se cargan.

    Son tres mundos distintos y no tres botones del mismo: sin estadísticas, por
    consenso (los que jugaron proponen y votan) o cargadas por el organizador. Un
    modo con planilla del organizador no puede aceptar votos, porque entonces
    habría dos fuentes de verdad para el mismo número.
    """
    origen = capacidades_de(match.get("mode")).get("stats_source")
    if origen == "ninguno":
        raise HTTPException(
            status_code=400,
            detail="Este partido no lleva estadísticas",
        )
    if origen != origen_esperado:
        detalle = (
            "En este modo las estadísticas las carga el organizador"
            if origen == "organizador"
            else "En este modo las estadísticas se proponen y se votan entre los que jugaron"
        )
        raise HTTPException(status_code=400, detail=detalle)


def _ensure_valores_seguidos(match: dict, valores: dict) -> dict:
    """Que sólo lleguen las estadísticas que este partido dijo que iba a seguir.

    Se rechaza en vez de filtrar en silencio: una estadística cargada que se
    descarta sin avisar es un dato que alguien tipeó y creyó guardado.
    """
    seguidas = set(stats_de(match))
    for stat_id in valores:
        if stat_id not in seguidas:
            nombre = TRACKABLE_STAT_MAP.get(stat_id, {}).get("name", stat_id)
            raise HTTPException(
                status_code=400,
                detail=f"Este partido no sigue {nombre}",
            )
    return valores


def _con_valores(doc: dict) -> dict:
    """Una fila de estadísticas lista para salir por la API.

    Viaja el dict `values` y, además, los tres de siempre como campos sueltos:
    hay pantallas y clientes cacheados que los leen por nombre, y devolverlos
    calculados desde `values` cuesta nada.
    """
    valores = valores_de_stats(doc)
    return {
        **doc,
        "values": valores,
        "goals": valores.get("goals", 0),
        "assists": valores.get("assists", 0),
        "saves": valores.get("saves", 0),
    }


@router.post("/{match_id}/finalize")
async def finalize_match(match_id: str, user=Depends(get_current_user)):
    """Marca el partido como jugado y abre las evaluaciones.

    El conteo de partidos jugados salió de acá: ahora lo hace
    `sincronizar_partidos_jugados`, que mira la asistencia y es idempotente.
    Antes era un `$inc` por titular escrito en línea, así que tocar dos veces
    "Finalizar partido" le sumaba dos partidos a cada uno — y ese contador es el
    que alimenta el índice de confianza del rating.
    """
    match = await get_match_or_404(match_id)
    await ensure_group_organizer(match["group_id"], user)

    if match.get("status") == "cancelado":
        raise HTTPException(status_code=400, detail="Un partido cancelado no se puede finalizar")
    # Finalizar un partido con la inscripción todavía abierta no significa nada:
    # se estaría contando como jugado a gente que todavía se puede anotar. La
    # pantalla nunca lo ofreció, pero el endpoint lo aceptaba.
    if match.get("status") == "abierto":
        raise HTTPException(
            status_code=400,
            detail="Cerrá la inscripción antes de finalizar el partido",
        )

    await db.matches.update_one(
        {"id": match_id}, {"$set": {"status": "finalizado"}}
    )

    jugaron = await sincronizar_partidos_jugados(match_id)

    return {
        "message": "Partido finalizado. Evaluaciones abiertas.",
        "played_count": len(jugaron),
    }


@router.put("/{match_id}/result")
async def set_match_result(match_id: str, data: SetMatchResultRequest, user=Depends(get_current_user)):
    """Carga o corrige el resultado del partido.

    Es un PUT y no un POST porque corregir un resultado mal cargado es el caso
    normal, no la excepción: se vuelve a mandar y pisa. Mismo criterio que la
    carga de resultados de un fixture de torneo.

    El marcador se guarda como `home`/`away` embebido en el partido. Embebido y
    no en su propia colección porque es uno a uno con el partido y se lee
    siempre junto con él: una colección aparte sería una query más para no
    ganar nada.
    """
    match = await get_match_or_404(match_id)
    await ensure_match_manager(match, user)

    if match.get("status") not in ["finalizado", "completado"]:
        raise HTTPException(
            status_code=400,
            detail="El resultado se carga cuando el partido está finalizado",
        )

    profile = await get_my_profile_or_404(user)
    notas = (data.notes or "").strip()

    # Si el partido es una llave de torneo, el dueño del marcador es el fixture.
    # Escribirlo acá dejaría dos verdades para el mismo número — y en una llave
    # con los dos grupos enlazados, dos escritores. Así que se delega: la llave
    # avanza, el torneo se cierra si corresponde, y la copia baja a este partido
    # y al del rival.
    if match.get("fixture_id"):
        return await _resultado_por_fixture(match, data, notas, profile)

    if data.home_penalties is not None or data.away_penalties is not None:
        raise HTTPException(
            status_code=400,
            detail="Los penales sólo se cargan en un partido de torneo que haya que definir",
        )

    resultado = {
        "home_score": data.home_score,
        "away_score": data.away_score,
        # La nota del partido es el contexto que explica un resultado raro
        # ("faltaron tres", "llovía", "se jugó en cancha chica"). Cuando el
        # resultado empiece a mover el puntaje, es lo que permite entender por
        # qué un equipo perdió sin culpar a los jugadores.
        "notes": notas or None,
        "loaded_by": profile["id"],
        "loaded_by_name": profile["name"],
        "loaded_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.matches.update_one({"id": match_id}, {"$set": {"result": resultado}})

    # El resultado no es sólo un dato para mostrar: es la señal que le dice al
    # sistema si el balanceo estuvo bien y cuánto vale cada jugador. Acá se
    # convierte en puntaje (ver services/match_outcomes).
    resumen = await recalcular_outcomes(match_id)

    ya_estaba = bool(match.get("result"))
    return {
        "message": "Resultado corregido" if ya_estaba else "Resultado guardado",
        "result": resultado,
        "rated_players": resumen["rows"],
    }


async def _resultado_por_fixture(match: dict, data, notas: str, profile: dict) -> dict:
    """Carga el resultado de un partido enlazado, pasando por su llave.

    Lo único delicado acá es la ORIENTACIÓN. El partido habla desde su lado
    ("les ganamos 3 a 1"), el fixture habla desde el equipo local. Para el
    partido del grupo visitante, su 3 a 1 es un 1 a 3 en la llave. Darlo vuelta
    al revés es el error que después nadie encuentra porque el número igual se
    ve bien, así que la conversión usa la misma función que la copia de vuelta.
    """
    fixture = await db.tournament_fixtures.find_one(
        {"id": match["fixture_id"]}, {"_id": 0}
    )
    if not fixture:
        raise HTTPException(
            status_code=400,
            detail="La llave de este partido ya no existe. Desenlazalo desde el torneo.",
        )

    lado = match.get("fixture_side") or "home"
    if lado == "away":
        local, visitante = data.away_score, data.home_score
        pen_local, pen_visitante = data.away_penalties, data.home_penalties
    else:
        local, visitante = data.home_score, data.away_score
        pen_local, pen_visitante = data.home_penalties, data.away_penalties

    # La nota es del partido y no viaja al torneo, así que se guarda antes: la
    # bajada del resultado conserva la que encuentre.
    await db.matches.update_one(
        {"id": match["id"]},
        {"$set": {"result": {**(match.get("result") or {}), "notes": notas or None}}},
    )

    try:
        actualizado = await aplicar_resultado(
            fixture,
            home_score=local,
            away_score=visitante,
            home_penalties=pen_local,
            away_penalties=pen_visitante,
            actor=profile,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    a_favor, en_contra, pen_a_favor, pen_en_contra = orientar(actualizado, lado)
    return {
        "message": "Resultado guardado y cargado al torneo",
        "result": {
            "home_score": a_favor,
            "away_score": en_contra,
            "home_penalties": pen_a_favor,
            "away_penalties": pen_en_contra,
            "notes": notas or None,
            "from_fixture": True,
        },
        "rated_players": 0,
    }


@router.put("/{match_id}/attendance")
async def set_attendance(match_id: str, data: SetAttendanceRequest, user=Depends(get_current_user)):
    """Marca quién vino y quién no.

    Anotarse no es venir. Hasta ahora el partido le sumaba un partido jugado a
    todos los anotados como titulares, incluido el que nunca apareció.

    Se puede marcar desde que la inscripción está cerrada. Mientras está abierta
    no tiene sentido: el que no va se da de baja solo. Y si el partido ya está
    finalizado, cambiar la asistencia reajusta el contador de partidos jugados
    en el acto (ver `sincronizar_partidos_jugados`), así que corregir una marca
    equivocada tres días después deja los números bien igual.
    """
    match = await get_match_or_404(match_id)
    await ensure_match_manager(match, user)

    if match.get("status") == "abierto":
        raise HTTPException(
            status_code=400,
            detail="La asistencia se toma cuando la inscripción está cerrada",
        )
    if match.get("status") == "cancelado":
        raise HTTPException(status_code=400, detail="El partido está cancelado")

    registrations = await db.match_registrations.find(
        {"match_id": match_id, "status": {"$ne": "baja"}},
        {"_id": 0},
    ).to_list(500)
    anotados = {reg["player_id"] for reg in registrations}

    pedidos: dict[str, str | None] = {}
    for entry in data.entries:
        if entry.player_id not in anotados:
            raise HTTPException(
                status_code=400,
                detail="Solo se puede marcar la asistencia de jugadores anotados en este partido",
            )
        pedidos[entry.player_id] = entry.attendance

    # Agrupado por marca: como mucho son cuatro escrituras (una por valor
    # posible más la de borrar), en vez de una por jugador.
    por_marca: dict[str | None, list[str]] = {}
    for player_id, marca in pedidos.items():
        por_marca.setdefault(marca, []).append(player_id)

    for marca, player_ids in por_marca.items():
        # Borrar la marca la devuelve a "no se tomó asistencia", que NO es lo
        # mismo que haber faltado: sin marca vale la regla vieja (titular jugó).
        operacion = {"$set": {"attendance": marca}} if marca else {"$unset": {"attendance": ""}}
        await db.match_registrations.update_many(
            {"match_id": match_id, "player_id": {"$in": sorted(player_ids)}},
            operacion,
        )

    jugaron = []
    if match.get("status") in ["finalizado", "completado"]:
        jugaron = await sincronizar_partidos_jugados(match_id)
        # La asistencia decide quién se lleva el resultado: el que plantó no
        # puede cobrar la victoria. Si el resultado ya estaba cargado, cambiar
        # una marca tiene que rehacer las filas.
        if match.get("result"):
            await recalcular_outcomes(match_id)

    return {
        "message": "Asistencia guardada",
        "updated": len(pedidos),
        "played_count": len(jugaron),
    }


@router.post("/{match_id}/ratings")
async def submit_ratings(match_id: str, data: PeerRatingBatchRequest, user=Depends(get_current_user)):
    match, profile, _ = await ensure_match_participant(match_id, user)
    _ensure_evalua_por_partido(match)

    if match.get("status") not in ["finalizado", "completado"]:
        raise HTTPException(status_code=400, detail="Las evaluaciones solo se habilitan cuando el partido esta finalizado")

    registrations = await db.match_registrations.find(
        {"match_id": match_id, "status": {"$ne": "baja"}},
        {"_id": 0},
    ).to_list(500)
    valid_player_ids = {registration["player_id"] for registration in registrations}

    valid_ratings = []
    for rating in data.ratings:
        if rating.score < 1 or rating.score > 10:
            continue
        if rating.rated_player_id == profile["id"]:
            continue
        if rating.rated_player_id not in valid_player_ids:
            raise HTTPException(status_code=400, detail="Solo podes evaluar jugadores que participaron en este partido")

        valid_ratings.append(rating)

    if not valid_ratings:
        raise HTTPException(status_code=400, detail="No hay evaluaciones validas para guardar")

    now = datetime.now(timezone.utc).isoformat()

    await db.peer_ratings.delete_many({"match_id": match_id, "rater_id": profile["id"]})

    for rating in valid_ratings:
        await db.peer_ratings.insert_one(
            {
                "id": str(uuid.uuid4()),
                "match_id": match_id,
                "rater_id": profile["id"],
                "rated_player_id": rating.rated_player_id,
                "score": rating.score,
                "created_at": now,
            }
        )

    return {"message": "Evaluaciones guardadas"}


@router.get("/{match_id}/ratings")
async def get_match_ratings(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_group_member(match["group_id"], user)

    profile = await db.player_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    visibility = await get_score_visibility_for_group(match["group_id"], user)

    if not profile:
        return {
            "my_ratings": [],
            "has_rated": False,
            "can_view_all_scores": visibility["can_view_all_scores"],
            "score_visibility_scope": visibility["scope"],
        }

    my_ratings = await db.peer_ratings.find(
        {"match_id": match_id, "rater_id": profile["id"]}, {"_id": 0}
    ).to_list(100)

    response = {
        "my_ratings": my_ratings,
        "has_rated": len(my_ratings) > 0,
        "can_view_all_scores": visibility["can_view_all_scores"],
        "score_visibility_scope": visibility["scope"],
    }

    if visibility["can_view_all_scores"]:
        peer_ratings = await db.peer_ratings.find({"match_id": match_id}, {"_id": 0}).to_list(1000)
        self_evaluations = await db.self_evaluations.find({"match_id": match_id}, {"_id": 0}).to_list(500)
        registrations = await db.match_registrations.find(
            {"match_id": match_id, "status": {"$ne": "baja"}},
            {"_id": 0},
        ).to_list(500)

        player_ids = sorted({registration["player_id"] for registration in registrations})
        players = await db.player_profiles.find({"id": {"$in": player_ids}}, {"_id": 0}).to_list(500)
        player_map = {player["id"]: player for player in players}
        self_eval_by_player = {eva["player_id"]: eva for eva in self_evaluations}

        ratings_by_player = {}
        for rating in peer_ratings:
            ratings_by_player.setdefault(rating["rated_player_id"], []).append(rating)

        player_summaries = []
        for registration in registrations:
            player_id = registration["player_id"]
            player = player_map.get(player_id, {})
            rows = ratings_by_player.get(player_id, [])
            avg_peer_score = None
            if rows:
                avg_peer_score = round(sum(r["score"] for r in rows) / len(rows), 2)

            player_summaries.append({
                "player_id": player_id,
                "player_name": player.get("name") or registration.get("player_name") or "Jugador",
                "player_photo": player.get("photo_url"),
                "peer_scores": [r["score"] for r in rows],
                "peer_rating_count": len(rows),
                "avg_peer_score": avg_peer_score,
                "self_evaluation": self_eval_by_player.get(player_id),
            })

        response["all_peer_ratings"] = peer_ratings
        response["all_self_evaluations"] = self_evaluations
        response["player_summaries"] = player_summaries

    return response


@router.post("/{match_id}/self-evaluation")
async def submit_self_evaluation(match_id: str, data: SelfEvaluationRequest, user=Depends(get_current_user)):
    match, profile, _ = await ensure_match_participant(match_id, user)
    _ensure_evalua_por_partido(match)
    if match.get("status") not in ["finalizado", "completado"]:
        raise HTTPException(status_code=400, detail="La autoevaluación solo se habilita cuando el partido está finalizado")

    now = datetime.now(timezone.utc).isoformat()

    await db.self_evaluations.update_one(
        {"match_id": match_id, "player_id": profile["id"]},
        {"$set": {
            "id": str(uuid.uuid4()),
            "match_id": match_id,
            "player_id": profile["id"],
            "score": data.score,
            "notes": data.notes,
            "created_at": now,
        }},
        upsert=True,
    )

    return {"message": "Autoevaluación guardada"}


@router.get("/{match_id}/self-evaluation")
async def get_self_evaluation(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_group_member(match["group_id"], user)

    profile = await db.player_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not profile:
        return None

    eva = await db.self_evaluations.find_one(
        {"match_id": match_id, "player_id": profile["id"]}, {"_id": 0}
    )
    return eva


@router.post("/{match_id}/stats/propose")
async def propose_stats(match_id: str, data: StatsProposalRequest, user=Depends(get_current_user)):
    match, profile, _ = await ensure_match_participant(match_id, user)
    _ensure_stats_por(match, "consenso")
    if match.get("status") not in ["finalizado", "completado"]:
        raise HTTPException(status_code=400, detail="Las estadísticas solo se cargan cuando el partido está finalizado")

    target_registration = await db.match_registrations.find_one(
        {"match_id": match_id, "player_id": data.player_id, "status": {"$ne": "baja"}},
        {"_id": 0},
    )
    if not target_registration:
        raise HTTPException(status_code=400, detail="Solo puedes proponer estadísticas para jugadores que participaron")

    now = datetime.now(timezone.utc).isoformat()
    valores = _ensure_valores_seguidos(match, data.valores())

    existing = await db.stats_proposals.find_one(
        {"match_id": match_id, "player_id": data.player_id, "proposed_by": profile["id"]},
        {"_id": 0},
    )
    if existing:
        # Se pisan también las tres columnas viejas: si quedaran las de antes,
        # un lector que todavía no mire `values` seguiría viendo la propuesta
        # anterior al lado de la nueva.
        await db.stats_proposals.update_one(
            {"id": existing["id"]},
            {"$set": {
                "values": valores,
                "goals": valores.get("goals", 0),
                "assists": valores.get("assists", 0),
                "saves": valores.get("saves", 0),
            }},
        )
        return {"message": "Propuesta actualizada"}

    proposal = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "player_id": data.player_id,
        "values": valores,
        "goals": valores.get("goals", 0),
        "assists": valores.get("assists", 0),
        "saves": valores.get("saves", 0),
        "proposed_by": profile["id"],
        "votes": [profile["id"]],
        "created_at": now,
    }
    await db.stats_proposals.insert_one(proposal)
    return {"message": "Propuesta de estadísticas creada", "id": proposal["id"]}


@router.get("/{match_id}/stats/proposals")
async def get_stats_proposals(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_group_member(match["group_id"], user)

    proposals = await db.stats_proposals.find({"match_id": match_id}, {"_id": 0}).to_list(500)
    if not proposals:
        return []

    player_ids = list({proposal["player_id"] for proposal in proposals})
    players = await db.player_profiles.find({"id": {"$in": player_ids}}, {"_id": 0}).to_list(500)
    player_map = {player["id"]: player for player in players}

    return [
        {
            **_con_valores(proposal),
            "player_name": (player_map.get(proposal["player_id"]) or {}).get("name", "Desconocido"),
        }
        for proposal in proposals
    ]


@router.post("/{match_id}/stats/vote")
async def vote_on_stats(match_id: str, data: StatsVoteRequest, user=Depends(get_current_user)):
    match, profile, _ = await ensure_match_participant(match_id, user)
    _ensure_stats_por(match, "consenso")
    if match.get("status") not in ["finalizado", "completado"]:
        raise HTTPException(status_code=400, detail="Las estadísticas solo se votan cuando el partido está finalizado")

    proposal = await db.stats_proposals.find_one({"id": data.proposal_id}, {"_id": 0})
    if not proposal or proposal.get("match_id") != match_id:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    if profile["id"] in proposal.get("votes", []):
        return {"message": "Ya votaste esta propuesta"}

    await db.stats_proposals.update_one(
        {"id": data.proposal_id},
        {"$push": {"votes": profile["id"]}},
    )

    updated = await db.stats_proposals.find_one({"id": data.proposal_id}, {"_id": 0})
    total_regs = await db.match_registrations.count_documents(
        {"match_id": match_id, "status": "titular"}
    )
    required_votes = max(2, total_regs // 2)

    if len(updated.get("votes", [])) >= required_votes:
        now = datetime.now(timezone.utc).isoformat()
        valores = valores_de_stats(updated)
        await db.stats_final.update_one(
            {"match_id": match_id, "player_id": updated["player_id"]},
            {"$set": {
                "id": str(uuid.uuid4()),
                "match_id": match_id,
                "player_id": updated["player_id"],
                "values": valores,
                "goals": valores.get("goals", 0),
                "assists": valores.get("assists", 0),
                "saves": valores.get("saves", 0),
                "confirmed_at": now,
                "source": "consenso",
            }},
            upsert=True,
        )
        return {"message": "Estadísticas confirmadas", "confirmed": True}

    return {
        "message": "Voto registrado",
        "confirmed": False,
        "votes": len(updated.get("votes", [])),
        "required": required_votes,
    }


@router.put("/{match_id}/stats")
async def set_match_stats(match_id: str, data: SetMatchStatsRequest, user=Depends(get_current_user)):
    """La planilla de estadísticas cargada de una, por el organizador.

    Existe porque la votación no escala. Confirmar por consenso está bien con
    tres números y diez jugadores; con ocho métricas y dieciséis jugadores son
    ciento veintiocho casillas que nadie va a votar, y las estadísticas
    terminarían sin confirmarse nunca. En los modos con planilla, lo que carga el
    organizador queda firme al guardar.

    Se guarda la planilla entera en cada llamada, así que un jugador que se manda
    sin estadísticas queda sin fila: es la forma de corregir una fila cargada por
    error.
    """
    match = await get_match_or_404(match_id)
    await ensure_match_manager(match, user)
    _ensure_stats_por(match, "organizador")

    if match.get("status") not in ["finalizado", "completado"]:
        raise HTTPException(
            status_code=400,
            detail="Las estadísticas se cargan cuando el partido está finalizado",
        )

    registrations = await db.match_registrations.find(
        {"match_id": match_id, "status": {"$ne": "baja"}},
        {"_id": 0},
    ).to_list(500)
    anotados = {reg["player_id"] for reg in registrations}

    filas = []
    for row in data.rows:
        if row.player_id not in anotados:
            raise HTTPException(
                status_code=400,
                detail="Solo se cargan estadísticas de jugadores que participaron",
            )
        valores = _ensure_valores_seguidos(match, row.values)
        if valores:
            filas.append((row.player_id, valores))

    now = datetime.now(timezone.utc).isoformat()
    actor = await get_my_profile_or_404(user)

    # Primero se borra lo que había y después se escribe lo que vino. Sin el
    # borrado, sacarle el gol a alguien que no lo hizo sería imposible: su fila
    # vieja quedaría ahí para siempre.
    await db.stats_final.delete_many({"match_id": match_id})

    for player_id, valores in filas:
        await db.stats_final.insert_one({
            "id": str(uuid.uuid4()),
            "match_id": match_id,
            "player_id": player_id,
            "values": valores,
            "goals": valores.get("goals", 0),
            "assists": valores.get("assists", 0),
            "saves": valores.get("saves", 0),
            "confirmed_at": now,
            "confirmed_by": actor["id"],
            "source": "organizador",
        })

    return {"message": "Estadísticas guardadas", "rows": len(filas)}


@router.get("/{match_id}/stats/final")
async def get_final_stats(match_id: str, user=Depends(get_current_user)):
    match = await get_match_or_404(match_id)
    await ensure_group_member(match["group_id"], user)

    stats = await db.stats_final.find({"match_id": match_id}, {"_id": 0}).to_list(100)
    if not stats:
        return []

    player_ids = list({row["player_id"] for row in stats})
    players = await db.player_profiles.find({"id": {"$in": player_ids}}, {"_id": 0}).to_list(200)
    player_map = {player["id"]: player for player in players}

    return [
        {
            **_con_valores(row),
            "player_name": (player_map.get(row["player_id"]) or {}).get("name", "Desconocido"),
        }
        for row in stats
    ]


@router.post("/{match_id}/complete")
async def complete_match(match_id: str, user=Depends(get_current_user)):
    """Mark match as fully completed."""
    match = await get_match_or_404(match_id)
    await ensure_group_organizer(match["group_id"], user)

    await db.matches.update_one(
        {"id": match_id}, {"$set": {"status": "completado"}}
    )
    return {"message": "Partido completado"}
