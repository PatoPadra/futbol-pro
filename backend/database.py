from constants import (
    DEFAULT_MATCH_MODE,
    DEFAULT_MATCH_TYPE,
    capacidades_de,
    resolver_stats_seguidas,
    valores_de_stats,
)
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
        # El enganche con los torneos: "los partidos de esta llave" y "los
        # partidos de este torneo". Sparse porque la enorme mayoría de los
        # partidos no son de torneo.
        {"keys": [("fixture_id", ASCENDING)], "sparse": True},
        {"keys": [("tournament_id", ASCENDING)], "sparse": True},
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
    # Torneos. Un torneo agrupa grupos: casi todas las lecturas arrancan por
    # tournament_id, y la de "en qué torneos juega este grupo" por group_id.
    "tournaments": [
        {"keys": [("id", ASCENDING)]},
        {"keys": [("created_by", ASCENDING)]},
    ],
    "tournament_teams": [
        {"keys": [("id", ASCENDING)]},
        {"keys": [("tournament_id", ASCENDING), ("seed", ASCENDING)]},
        {"keys": [("group_id", ASCENDING)]},
    ],
    "tournament_fixtures": [
        {"keys": [("id", ASCENDING)]},
        {"keys": [("tournament_id", ASCENDING), ("round", ASCENDING), ("order", ASCENDING)]},
        {"keys": [("tournament_id", ASCENDING), ("status", ASCENDING)]},
    ],
    # Notas privadas del organizador. Las dos lecturas que existen son "las
    # mías de este partido" y "las mías sobre este jugador".
    "player_match_notes": [
        {"keys": [("match_id", ASCENDING), ("author_id", ASCENDING)]},
        {"keys": [("author_id", ASCENDING), ("player_id", ASCENDING)]},
    ],
    # El resultado convertido en puntaje. Se lee siempre por jugador (para
    # calcular su rating) y se borra siempre por partido (al recalcular).
    "match_outcomes": [
        {"keys": [("match_id", ASCENDING)]},
        {"keys": [("player_id", ASCENDING)]},
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


async def backfill_match_defaults() -> None:
    """Le pone modo, tipo y contador de asistencia a lo que ya existía.

    Idempotente: cada paso filtra por `$exists: False`, así que correrla en cada
    arranque no hace nada después de la primera vez.

    El default es "avanzado" porque es exactamente lo que la app hacía antes de
    que los modos existieran: equipos automáticos, evaluación entre pares y
    estadísticas por consenso. Y "oficial" porque hasta ahora todos los partidos
    contaban igual — degradarlos retroactivamente a práctica cambiaría el peso de
    un historial que se cargó bajo otra regla.

    El paso delicado es el último. Los partidos ya finalizados YA le sumaron un
    partido jugado a sus titulares con el código viejo, que no dejaba registro de
    a quién había contado. Si quedaran sin `counted_player_ids`, la primera vez
    que alguien tocara su asistencia el sincronizador creería que no contó a
    nadie y les sumaría el partido por segunda vez. Por eso se reconstruye el
    conjunto que aquel código habría contado: los titulares, ni más ni menos.
    """
    await db.matches.update_many(
        {"mode": {"$exists": False}}, {"$set": {"mode": DEFAULT_MATCH_MODE}}
    )
    await db.matches.update_many(
        {"match_type": {"$exists": False}}, {"$set": {"match_type": DEFAULT_MATCH_TYPE}}
    )
    await db.groups.update_many(
        {"default_match_mode": {"$exists": False}},
        {"$set": {"default_match_mode": DEFAULT_MATCH_MODE}},
    )

    ya_jugados = await db.matches.find(
        {
            "status": {"$in": ["finalizado", "completado"]},
            "counted_player_ids": {"$exists": False},
        },
        {"_id": 0, "id": 1},
    ).to_list(5000)

    for match in ya_jugados:
        titulares = await db.match_registrations.find(
            {"match_id": match["id"], "status": "titular"},
            {"_id": 0, "player_id": 1},
        ).to_list(500)
        await db.matches.update_one(
            {"id": match["id"]},
            {"$set": {"counted_player_ids": sorted({t["player_id"] for t in titulares})}},
        )

    # Los que todavía no se jugaron no le sumaron el partido a nadie.
    await db.matches.update_many(
        {"counted_player_ids": {"$exists": False}}, {"$set": {"counted_player_ids": []}}
    )

    if ya_jugados:
        logger.info(
            "Migración de modos: %d partidos ya finalizados quedaron con su conteo reconstruido",
            len(ya_jugados),
        )

    await _backfill_estadisticas()


async def _backfill_estadisticas() -> None:
    """Pasa las estadísticas de tres columnas fijas a un dict, y le pone a cada
    partido qué estadísticas sigue.

    Las tres columnas viejas NO se borran. Cuestan nada, las siguen leyendo
    clientes cacheados, y borrarlas convertiría una migración aditiva en una que
    puede perder datos si algo sale mal a mitad de camino.

    Idempotente por el `$exists: False`, igual que el resto.
    """
    sin_seguidas = await db.matches.find(
        {"tracked_stats": {"$exists": False}},
        {"_id": 0, "id": 1, "mode": 1},
    ).to_list(5000)

    for match in sin_seguidas:
        # Se resuelve desde el modo y no se pone la lista clásica a todos: si
        # mañana esta migración corre sobre partidos que ya nacieron en modo
        # Diversión, no tienen que quedar con estadísticas que nadie sigue.
        seguidas = resolver_stats_seguidas(capacidades_de(match.get("mode")), None)
        await db.matches.update_one({"id": match["id"]}, {"$set": {"tracked_stats": seguidas}})

    migradas = 0
    for coleccion in (db.stats_final, db.stats_proposals):
        docs = await coleccion.find({"values": {"$exists": False}}, {"_id": 0}).to_list(20000)
        for doc in docs:
            if not doc.get("id"):
                continue
            await coleccion.update_one(
                {"id": doc["id"]}, {"$set": {"values": valores_de_stats(doc)}}
            )
            migradas += 1

    if sin_seguidas or migradas:
        logger.info(
            "Migración de estadísticas: %d partidos con lista de seguidas, %d filas pasadas a dict",
            len(sin_seguidas),
            migradas,
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
