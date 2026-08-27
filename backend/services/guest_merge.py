from datetime import datetime, timezone

from database import db

# Todos los lugares donde un perfil aparece nombrado, con la forma
# `(colección, campo)`. Está escrito como una lista y no desparramado en el
# código porque la lista vieja quedó congelada en el momento en que se escribió:
# después el proyecto sumó `match_outcomes`, `self_evaluations` y
# `player_match_notes`, y nadie volvió acá.
#
# `match_outcomes` era la peor de las tres. Es la colección que mueve el
# puntaje, así que un invitado con diez partidos que se vinculaba a su cuenta
# perdía los diez outcomes —el rating le bajaba de golpe— mientras el
# `matches_played` SÍ se sumaba: denominador inflado contra numerador vacío.
#
# Si mañana aparece una colección nueva que guarde un player_id, se agrega acá.
REFERENCIAS_SIMPLES = (
    ("peer_ratings", "rated_player_id"),
    # El invitado también EVALÚA, no sólo es evaluado. Esta mitad faltaba.
    ("peer_ratings", "rater_id"),
    ("group_seed_ratings", "rated_player_id"),
    ("group_seed_ratings", "rater_id"),
    ("stats_proposals", "player_id"),
    ("stats_proposals", "proposed_by"),
    ("stats_final", "player_id"),
    ("match_outcomes", "player_id"),
    ("self_evaluations", "player_id"),
    ("player_match_notes", "player_id"),
    ("player_match_notes", "author_id"),
    ("match_registrations", "registered_by"),
    ("player_profiles", "created_by"),
)


async def _reemplazar_en_lista(coleccion: str, campo: str, viejo: str, nuevo: str) -> None:
    """Cambia un id adentro de un array de strings, sin duplicarlo.

    Se hace leyendo y escribiendo en vez de con un operador posicional porque el
    caso interesante es justo cuando los DOS ids están en la lista: ahí no hay
    que reemplazar, hay que sacar uno. Un `$set` posicional dejaría el id
    repetido, y en `counted_player_ids` eso significa contarle el partido dos
    veces a la misma persona.
    """
    documentos = await db[coleccion].find({campo: viejo}, {"_id": 0, "id": 1, campo: 1}).to_list(1000)
    for documento in documentos:
        actual = documento.get(campo) or []
        actualizado = sorted({nuevo if valor == viejo else valor for valor in actual})
        await db[coleccion].update_one({"id": documento["id"]}, {"$set": {campo: actualizado}})


async def _reemplazar_en_asignaciones(viejo: str, nuevo: str) -> None:
    """El player_id adentro de `team_generations.assignments`.

    Sin `array_filters` a propósito: la alineación de un partido tiene a lo sumo
    22 elementos y una fusión toca un puñado de generaciones, así que leer y
    escribir el documento no cuesta nada — y encima funciona igual en el Mongo
    en memoria de los tests, que no implementa filtros de array.
    """
    generaciones = await db.team_generations.find(
        {"assignments.player_id": viejo}, {"_id": 0}
    ).to_list(1000)
    for generacion in generaciones:
        asignaciones = []
        for asignacion in generacion.get("assignments", []):
            if asignacion.get("player_id") == viejo:
                asignacion = {**asignacion, "player_id": nuevo}
            asignaciones.append(asignacion)
        await db.team_generations.update_one(
            {"id": generacion["id"]}, {"$set": {"assignments": asignaciones}}
        )


async def merge_guest_into_profile(guest_id: str, target_profile_id: str) -> dict | None:
    """Vuelca el historial de un invitado sin dueño adentro de una cuenta real.

    Reasigna TODA referencia al invitado para que el perfil verdadero conserve
    su propio id: nada más en la app necesita enterarse de que hubo una fusión.
    Cuida los duplicados cuando el destino ya tiene su propia inscripción o
    membresía para el mismo partido o grupo.

    El invitado no se borra: queda marcado como fusionado. Con `delete_one` una
    fusión mal hecha era irreparable, porque el perfil origen dejaba de existir
    en el mismo momento en que se descubría el problema.
    """
    guest = await db.player_profiles.find_one({"id": guest_id}, {"_id": 0})
    if not guest or guest.get("player_type") != "invitado" or guest.get("user_id"):
        return None

    guest_memberships = await db.group_members.find({"player_id": guest_id}, {"_id": 0}).to_list(200)
    for membership in guest_memberships:
        target_has_membership = await db.group_members.find_one(
            {"group_id": membership["group_id"], "player_id": target_profile_id, "status": "activo"},
            {"_id": 0},
        )
        if target_has_membership:
            await db.group_members.delete_one({"id": membership["id"]})
        else:
            await db.group_members.update_one(
                {"id": membership["id"]}, {"$set": {"player_id": target_profile_id}}
            )

    guest_registrations = await db.match_registrations.find({"player_id": guest_id}, {"_id": 0}).to_list(500)
    for reg in guest_registrations:
        target_has_active_reg = await db.match_registrations.find_one(
            {"match_id": reg["match_id"], "player_id": target_profile_id, "status": {"$ne": "baja"}},
            {"_id": 0},
        )
        if target_has_active_reg and reg.get("status") != "baja":
            await db.match_registrations.delete_one({"id": reg["id"]})
        else:
            await db.match_registrations.update_one(
                {"id": reg["id"]}, {"$set": {"player_id": target_profile_id}}
            )

    for coleccion, campo in REFERENCIAS_SIMPLES:
        await db[coleccion].update_many(
            {campo: guest_id}, {"$set": {campo: target_profile_id}}
        )

    await _reemplazar_en_asignaciones(guest_id, target_profile_id)

    # `counted_player_ids` es el diferencial con el que `sincronizar_partidos_jugados`
    # sabe qué aportó cada partido al contador. Si sigue nombrando al invitado, el
    # día que alguien toque la asistencia de ese partido el sincronizador cree que
    # el jugador real nunca fue contado y le suma el partido otra vez.
    await _reemplazar_en_lista("matches", "counted_player_ids", guest_id, target_profile_id)
    await _reemplazar_en_lista("stats_proposals", "votes", guest_id, target_profile_id)

    if guest.get("matches_played"):
        await db.player_profiles.update_one(
            {"id": target_profile_id}, {"$inc": {"matches_played": guest["matches_played"]}}
        )

    await db.player_profiles.update_one(
        {"id": guest_id},
        {
            "$set": {
                "player_type": "fusionado",
                "merged_into": target_profile_id,
                "merged_at": datetime.now(timezone.utc).isoformat(),
                # El invitado fusionado deja de ser una persona buscable: sin
                # email no aparece en la vinculación automática del registro ni
                # colisiona con el índice único que viene después.
                "email": None,
            }
        },
    )
    return guest
