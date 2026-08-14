"""
Rate limiting simple apoyado en Mongo.

Por qué en Mongo y no en memoria: en Render el proceso se reinicia solo (y puede
haber más de un worker), así que un contador en memoria se borra justo cuando más
sirve. Acá cada intento es un documento con TTL, y Mongo los limpia solo — no hace
falta ninguna tarea de mantenimiento ni una dependencia nueva.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request

from database import db

COLLECTION = "rate_limit_hits"

# Ventana del índice TTL (ver INDEX_SPEC en database.py). Los límites de cada
# endpoint tienen que entrar en esta ventana, porque pasado este tiempo Mongo
# borra el documento y el intento deja de contar.
TTL_SECONDS = 3600


def client_ip(request: Request) -> str:
    """
    IP del cliente. Detrás del proxy de Render, request.client.host es el proxy,
    así que el dato real es el primer valor de X-Forwarded-For.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "desconocido"


async def check_rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    """Tira 429 si `key` superó max_attempts dentro de la ventana."""
    desde = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
    intentos = await db[COLLECTION].count_documents({"key": key, "created_at": {"$gte": desde}})

    if intentos >= max_attempts:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Esperá unos minutos y probá de nuevo.",
            headers={"Retry-After": str(window_seconds)},
        )


async def record_attempt(key: str) -> None:
    """Un documento por intento. Lo borra el TTL, no nosotros."""
    # created_at va como datetime real (no ISO string) porque el índice TTL de
    # Mongo sólo funciona sobre un campo de tipo Date.
    await db[COLLECTION].insert_one({"key": key, "created_at": datetime.now(timezone.utc)})


async def clear_attempts(key: str) -> None:
    """Se llama cuando el intento sale bien, para no penalizar a quien acertó."""
    await db[COLLECTION].delete_many({"key": key})
