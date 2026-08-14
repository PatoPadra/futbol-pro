from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError, OperationFailure
import logging
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


# Los índices salen de un relevamiento de las queries que existen de verdad en
# routes_*.py y services/*.py, no de una lista genérica. El número al costado es
# la cantidad de queries que aprovechan cada uno.
#
# Sobre los índices compuestos: Mongo puede usar cualquier PREFIJO de un índice,
# así que (match_id, status) también sirve para buscar sólo por match_id. Por eso
# no hace falta un índice suelto de match_id además del compuesto.
#
# Los "id" van sin unique a propósito: son uuid4 generados por la app, la colisión
# es imposible en la práctica y un unique sólo agregaría un modo de falla al boot.
# La excepción es users.email, donde el unique sí aporta correctitud (ver abajo).
INDEX_SPEC = {
    "users": [
        ({"keys": [("id", ASCENDING)]}),
        ({"keys": [("verification_token", ASCENDING)], "sparse": True}),
    ],
    "player_profiles": [
        {"keys": [("id", ASCENDING)]},
        {"keys": [("user_id", ASCENDING)]},
        {"keys": [("email", ASCENDING)]},
    ],
    "groups": [
        {"keys": [("id", ASCENDING)]},
    ],
    "group_members": [
        {"keys": [("id", ASCENDING)]},
        {"keys": [("group_id", ASCENDING), ("status", ASCENDING)]},
        {"keys": [("group_id", ASCENDING), ("player_id", ASCENDING), ("status", ASCENDING)]},
        {"keys": [("player_id", ASCENDING), ("status", ASCENDING)]},
    ],
    "matches": [
        {"keys": [("id", ASCENDING)]},
        {"keys": [("status", ASCENDING)]},
        {"keys": [("group_id", ASCENDING), ("status", ASCENDING)]},
    ],
    "match_registrations": [
        {"keys": [("id", ASCENDING)]},
        # 19 queries: el endpoint más caliente de la app.
        {"keys": [("match_id", ASCENDING), ("status", ASCENDING)]},
        {"keys": [("match_id", ASCENDING), ("player_id", ASCENDING), ("status", ASCENDING)]},
        {"keys": [("player_id", ASCENDING), ("status", ASCENDING)]},
    ],
    "peer_ratings": [
        {"keys": [("match_id", ASCENDING), ("rater_id", ASCENDING)]},
        {"keys": [("match_id", ASCENDING), ("rated_player_id", ASCENDING)]},
        {"keys": [("rated_player_id", ASCENDING)]},
    ],
    "self_evaluations": [
        {"keys": [("match_id", ASCENDING), ("player_id", ASCENDING)]},
    ],
    "stats_final": [
        {"keys": [("match_id", ASCENDING), ("player_id", ASCENDING)]},
        {"keys": [("player_id", ASCENDING)]},
    ],
    "stats_proposals": [
        {"keys": [("id", ASCENDING)]},
        {"keys": [("match_id", ASCENDING), ("player_id", ASCENDING)]},
        {"keys": [("player_id", ASCENDING)]},
    ],
    "team_generations": [
        {"keys": [("match_id", ASCENDING)]},
        {"keys": [("assignments.player_id", ASCENDING)]},
    ],
    # Rate limiting: el TTL hace que Mongo borre solo los intentos viejos.
    "rate_limit_hits": [
        {"keys": [("key", ASCENDING), ("created_at", ASCENDING)]},
        {"keys": [("created_at", ASCENDING)], "expireAfterSeconds": 3600},
    ],
    "group_seed_ratings": [
        {"keys": [("group_id", ASCENDING), ("rater_id", ASCENDING)]},
        {"keys": [("rated_player_id", ASCENDING)]},
    ],
}


async def _ensure_unique_email_index() -> None:
    """
    users.email UNIQUE: hoy la unicidad se chequea sólo en código (un find_one
    antes del insert en routes_auth), lo que deja una ventana para que dos altas
    concurrentes con el mismo mail entren las dos. El índice lo cierra en la base.

    Si ya hay duplicados (típicamente por mayúsculas, de antes de que se
    normalizara el email), createIndex aborta con E11000 y el índice NO se crea.
    Eso NO debe impedir que la app levante: avisamos fuerte y seguimos.
    """
    try:
        await db.users.create_index([("email", ASCENDING)], unique=True, name="email_unique")
    except (DuplicateKeyError, OperationFailure) as e:
        logger.warning(
            "No se pudo crear el índice único de users.email: %s. "
            "Casi seguro hay emails duplicados en la base (revisá los que difieren "
            "sólo en mayúsculas). Hay que resolverlos a mano y reiniciar. "
            "Mientras tanto la app funciona, pero el registro sigue expuesto a la "
            "condición de carrera de alta duplicada.",
            e,
        )


async def ensure_indexes() -> None:
    """Idempotente: create_index no hace nada si el índice ya existe."""
    created = 0
    for collection_name, specs in INDEX_SPEC.items():
        for spec in specs:
            try:
                kwargs = {"sparse": spec.get("sparse", False)}
                if "expireAfterSeconds" in spec:
                    kwargs["expireAfterSeconds"] = spec["expireAfterSeconds"]
                await db[collection_name].create_index(spec["keys"], **kwargs)
                created += 1
            except OperationFailure as e:
                logger.warning(
                    "No se pudo crear el índice %s sobre %s: %s",
                    spec["keys"], collection_name, e,
                )

    await _ensure_unique_email_index()
    logger.info("Índices verificados (%d definiciones aplicadas)", created)
