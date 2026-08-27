from constants import (
    DEFAULT_MATCH_MODE,
    DEFAULT_MATCH_TYPE,
    DEFAULT_USER_ROLE,
    LEGACY_USER_ROLE,
    capacidades_de,
    deadline_de,
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
        # La unicidad del email vivía sólo en código (un find_one antes del
        # insert), lo que deja una ventana para que dos altas concurrentes con
        # el mismo mail entren las dos.
        ({"keys": [("email", ASCENDING)], "unique": True}),
    ],
    "player_profiles": [
        {"keys": [("id", ASCENDING)]},
        # Un usuario, un perfil. Con dos, `find_one({"user_id": ...})` devuelve
        # uno arbitrario y el historial de esa persona queda partido al medio
        # según cuál salga. El filtro parcial es por `$type` y no `sparse`
        # porque los invitados tienen `user_id: None` explícito, no ausente:
        # con sparse entrarían todos al índice y colisionarían entre ellos.
        {
            "keys": [("user_id", ASCENDING)],
            "unique": True,
            "partial": {"user_id": {"$type": "string"}},
        },
        {"keys": [("email", ASCENDING)]},
    ],
    "groups": [
        {"keys": [("id", ASCENDING)]},
    ],
    "group_members": [
        {"keys": [("id", ASCENDING)]},
        # Una membresía por persona por grupo. Sin filtrar por status a
        # propósito: `add_group_member` reusa el documento existente cuando
        # alguien vuelve, así que el par tiene que ser único esté activo o no.
        {"keys": [("group_id", ASCENDING), ("player_id", ASCENDING)], "unique": True},
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
        # Una inscripción viva por jugador por partido. El doble tap en el
        # celular con red lenta no es el caso borde, es el caso normal: sin
        # esto el jugador se cuenta dos veces en el cupo, aparece dos veces en
        # el balanceador y suma dos partidos jugados.
        #
        # `$in` y no `$ne: "baja"`: los filtros parciales no aceptan `$ne`. Las
        # bajas quedan fuera del índice, que es lo que se quiere — alguien se
        # puede dar de baja y volver a anotar.
        {
            "keys": [("match_id", ASCENDING), ("player_id", ASCENDING)],
            "unique": True,
            "partial": {"status": {"$in": ["titular", "suplente"]}},
        },
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
        # Una autoevaluación por jugador por partido: el endpoint hace upsert
        # sobre esta clave.
        {"keys": [("match_id", ASCENDING), ("player_id", ASCENDING)], "unique": True},
    ],
    "stats_final": [
        # Una fila confirmada por jugador por partido. La carga borra todas las
        # del partido y reescribe, así que el par nunca se repite.
        {"keys": [("match_id", ASCENDING), ("player_id", ASCENDING)], "unique": True},
        {"keys": [("player_id", ASCENDING)]},
    ],
    "stats_proposals": [
        {"keys": [("id", ASCENDING)]},
        {"keys": [("match_id", ASCENDING), ("player_id", ASCENDING)]},
        {"keys": [("player_id", ASCENDING)]},
    ],
    "team_generations": [
        # Una generación por partido. Era una convención sostenida por un
        # `delete_many` antes del insert; ahora la sostiene la base.
        {"keys": [("match_id", ASCENDING)], "unique": True},
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
        # La clave del upsert. Sirve además como prefijo para "mis notas de
        # este partido", así que reemplaza al índice suelto que había.
        {
            "keys": [("match_id", ASCENDING), ("author_id", ASCENDING), ("player_id", ASCENDING)],
            "unique": True,
        },
        {"keys": [("author_id", ASCENDING), ("player_id", ASCENDING)]},
    ],
    # El resultado convertido en puntaje. Se lee siempre por jugador (para
    # calcular su rating) y se borra siempre por partido (al recalcular).
    "match_outcomes": [
        {"keys": [("match_id", ASCENDING)]},
        {"keys": [("player_id", ASCENDING)]},
    ],
    # Invitaciones por link. El token es la llave de entrada al grupo, asi que
    # va unico: dos invitaciones con el mismo token serian dos puertas que
    # abren la misma cerradura sin que nadie sepa cual es cual.
    "group_invitations": [
        {"keys": [("token", ASCENDING)], "unique": True},
        {"keys": [("group_id", ASCENDING), ("revoked_at", ASCENDING)]},
    ],
    "group_seed_ratings": [
        # Un puntaje inicial por evaluador y evaluado dentro del grupo.
        {
            "keys": [("group_id", ASCENDING), ("rater_id", ASCENDING), ("rated_player_id", ASCENDING)],
            "unique": True,
        },
        {"keys": [("rated_player_id", ASCENDING)]},
    ],
}


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

    await _backfill_roles_y_deadlines()
    await _backfill_estadisticas()


async def _backfill_roles_y_deadlines() -> None:
    """Baja el rol global que se elimino, y recalcula los deadlines clavados.

    Los dos son idempotentes: el filtro no vuelve a encontrar nada despues de la
    primera corrida.

    El rol "organizador" dejo de existir (ver USER_ROLES). Nadie pierde nada al
    pasar a "jugador": lo que ese rol habilitaba —crear grupos y torneos— ahora
    depende del rol DENTRO del grupo, y quien organizaba grupos los sigue
    organizando.

    Los deadlines viejos son todos `{fecha}T12:00:00+00:00`, o sea las 9 de la
    manana en Argentina, para partidos que en general se juegan a la noche. Se
    recalculan desde la hora real del partido.
    """
    degradados = await db.users.update_many(
        {"role": LEGACY_USER_ROLE}, {"$set": {"role": DEFAULT_USER_ROLE}}
    )
    if degradados.modified_count:
        logger.info(
            "Migracion de roles: %d cuentas pasaron de organizador a jugador",
            degradados.modified_count,
        )

    clavados = await db.matches.find(
        {"deadline": {"$regex": "T12:00:00\+00:00$"}},
        {"_id": 0, "id": 1, "date": 1, "time": 1},
    ).to_list(5000)
    for match in clavados:
        await db.matches.update_one(
            {"id": match["id"]},
            {"$set": {"deadline": deadline_de(match["date"], match.get("time"))}},
        )
    if clavados:
        logger.info("Migracion de deadlines: %d partidos recalculados", len(clavados))


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


async def _indice_existente_con_las_mismas_claves(collection_name: str, keys: list):
    """El índice ya creado que usa exactamente este patrón de claves, si lo hay."""
    buscado = dict(keys)
    async for existente in db[collection_name].list_indexes():
        if existente["name"] == "_id_":
            continue
        if dict(existente["key"]) == buscado:
            return existente
    return None


async def _crear_indice(collection_name: str, spec: dict) -> bool:
    """Crea un índice, reemplazando al que estorbe si el nuevo es único.

    Mongo rechaza crear un índice con el mismo patrón de claves y opciones
    distintas, así que pasar uno existente a `unique` exige borrar el viejo
    primero. Sólo lo hacemos cuando el nuevo es único: nunca borramos un índice
    por una diferencia cosmética.

    Ninguna falla acá impide que la app levante — pero se avisa fuerte, porque
    un índice único que no se creó es una garantía que alguien va a creer que
    existe. La causa casi siempre es que ya hay duplicados en la base: hay que
    resolverlos a mano y reiniciar (ver backend/scripts/diagnostico_cierre_etapa.py).
    """
    kwargs = {}
    if spec.get("sparse"):
        kwargs["sparse"] = True
    if spec.get("unique"):
        kwargs["unique"] = True
    if spec.get("partial"):
        kwargs["partialFilterExpression"] = spec["partial"]
    if "expireAfterSeconds" in spec:
        kwargs["expireAfterSeconds"] = spec["expireAfterSeconds"]

    try:
        await db[collection_name].create_index(spec["keys"], **kwargs)
        return True
    except DuplicateKeyError as e:
        logger.warning(
            "HAY DUPLICADOS: no se pudo crear el índice único %s sobre %s: %s. "
            "La app funciona, pero esa unicidad NO está garantizada. "
            "Corré backend/scripts/diagnostico_cierre_etapa.py para verlos.",
            spec["keys"], collection_name, e,
        )
        return False
    except OperationFailure as e:
        # 85 IndexOptionsConflict / 86 IndexKeySpecsConflict: ya existe con
        # otras opciones. Es el caso de los índices que nacieron sin unique.
        if e.code in (85, 86) and spec.get("unique"):
            anterior = await _indice_existente_con_las_mismas_claves(collection_name, spec["keys"])
            if anterior:
                logger.info(
                    "Reemplazando el índice %s de %s por su versión única",
                    anterior["name"], collection_name,
                )
                await db[collection_name].drop_index(anterior["name"])
                return await _crear_indice(collection_name, spec)

        logger.warning(
            "No se pudo crear el índice %s sobre %s: %s",
            spec["keys"], collection_name, e,
        )
        return False


async def ensure_indexes() -> None:
    """Idempotente: create_index no hace nada si el índice ya existe igual."""
    creados = 0
    fallados = 0
    for collection_name, specs in INDEX_SPEC.items():
        for spec in specs:
            if await _crear_indice(collection_name, spec):
                creados += 1
            else:
                fallados += 1

    if fallados:
        logger.warning(
            "Índices verificados: %d aplicados, %d NO se pudieron crear (ver arriba)",
            creados, fallados,
        )
    else:
        logger.info("Índices verificados (%d definiciones aplicadas)", creados)
