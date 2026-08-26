"""
Anotaciones del organizador sobre un jugador en un partido.

Son PRIVADAS de quien las escribe. Esa es la decisión de diseño, no un detalle
de implementación: una nota sobre una persona, visible por esa persona, deja de
ser una nota y pasa a ser un mensaje. "No marcó al pivot" escrito para acordarse
y "no marcó al pivot" leído por el aludido son dos cosas distintas, y la segunda
cambia cómo se juega el sábado que viene.

Por eso tampoco las comparte el cuerpo técnico: ni siquiera otro organizador del
mismo grupo ve las mías. Si algún día hace falta compartirlas, que sea una
decisión explícita de quien las escribió y no algo que ya venía pasando.

Para qué sirven: son el contexto que el número no guarda. El puntaje dice que
rindió 6; la nota dice por qué.
"""

from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import db
from models import PlayerNoteRequest
from services.matches import ensure_match_manager, get_match_or_404
from services.profiles import get_my_profile_or_404

router = APIRouter(prefix="/api", tags=["notes"])

MAX_NOTAS_POR_JUGADOR = 200


@router.put("/matches/{match_id}/notes/{player_id}")
async def guardar_nota(
    match_id: str,
    player_id: str,
    data: PlayerNoteRequest,
    user=Depends(get_current_user),
):
    """Guarda (o borra) mi nota sobre un jugador en este partido.

    Un texto vacío BORRA la nota en vez de guardar una nota en blanco. Es lo que
    espera quien selecciona todo y aprieta borrar, y evita una colección llena de
    filas que no dicen nada.
    """
    match = await get_match_or_404(match_id)
    await ensure_match_manager(match, user)

    if match.get("status") == "abierto":
        raise HTTPException(
            status_code=400,
            detail="Las notas se toman cuando la inscripción está cerrada",
        )

    registro = await db.match_registrations.find_one(
        {"match_id": match_id, "player_id": player_id, "status": {"$ne": "baja"}},
        {"_id": 0},
    )
    if not registro:
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden anotar jugadores que participaron del partido",
        )

    autor = await get_my_profile_or_404(user)
    texto = (data.text or "").strip()
    clave = {"match_id": match_id, "player_id": player_id, "author_id": autor["id"]}

    if not texto:
        await db.player_match_notes.delete_one(clave)
        return {"message": "Nota borrada", "text": None}

    ahora = datetime.now(timezone.utc).isoformat()
    await db.player_match_notes.update_one(
        clave,
        {
            "$set": {**clave, "text": texto, "updated_at": ahora},
            "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": ahora},
        },
        upsert=True,
    )
    return {"message": "Nota guardada", "text": texto}


@router.get("/matches/{match_id}/notes")
async def mis_notas_del_partido(match_id: str, user=Depends(get_current_user)):
    """Mis notas de este partido, indexadas por jugador.

    Devuelve un dict y no una lista porque quien la consume es una lista de
    jugadores que necesita preguntar "¿tengo algo escrito de este?" por cada uno.
    """
    match = await get_match_or_404(match_id)
    await ensure_match_manager(match, user)

    autor = await get_my_profile_or_404(user)
    notas = await db.player_match_notes.find(
        {"match_id": match_id, "author_id": autor["id"]},
        {"_id": 0},
    ).to_list(MAX_NOTAS_POR_JUGADOR)

    return {nota["player_id"]: {"text": nota["text"], "updated_at": nota.get("updated_at")} for nota in notas}


@router.get("/players/{player_id}/notes")
async def mis_notas_del_jugador(player_id: str, user=Depends(get_current_user)):
    """Todo lo que yo escribí sobre este jugador, de la fecha más nueva a la más vieja.

    Es la vista que hace que las notas valgan la pena: sueltas son un post-it,
    juntas y en orden son la historia de un jugador contada por quien lo dirige.
    """
    autor = await get_my_profile_or_404(user)
    notas = await db.player_match_notes.find(
        {"player_id": player_id, "author_id": autor["id"]},
        {"_id": 0},
    ).to_list(MAX_NOTAS_POR_JUGADOR)

    if not notas:
        return []

    match_ids = sorted({nota["match_id"] for nota in notas})
    partidos = await db.matches.find(
        {"id": {"$in": match_ids}},
        {"_id": 0, "id": 1, "title": 1, "date": 1, "match_type": 1},
    ).to_list(len(match_ids))
    por_id = {partido["id"]: partido for partido in partidos}

    filas = []
    for nota in notas:
        partido = por_id.get(nota["match_id"]) or {}
        filas.append({
            "match_id": nota["match_id"],
            "match_title": partido.get("title"),
            "match_date": partido.get("date"),
            "match_type": partido.get("match_type"),
            "text": nota["text"],
            "updated_at": nota.get("updated_at"),
        })

    # Por fecha del partido y no por la de escritura: lo que se quiere reconstruir
    # es cómo fue evolucionando el jugador, no en qué orden se escribieron.
    filas.sort(key=lambda fila: fila.get("match_date") or "", reverse=True)
    return filas
