"""
Baja de cuenta, por anonimización.

POR QUÉ NO SE BORRA LA FILA. Borrarla sería exactamente el bug que la auditoría
encontró en el borrado de grupo, pero peor: quedarían colgados los
`match_outcomes` de esa persona —que son los que mueven el puntaje—, sus
evaluaciones a terceros, y su lugar en los equipos de partidos ya jugados. Los
partidos de LOS DEMÁS pasarían a tener diez jugadores en vez de once, y el
historial de todo el grupo quedaría mintiendo.

Así que la fila sobrevive sin datos personales: el nombre pasa a "Jugador dado
de baja", se van el email, la foto, la fecha de nacimiento y el género, y la
cuenta deja de poder entrar. La persona deja de existir como dato personal y la
historia deportiva de los demás sigue siendo cierta. Es además lo que pide
cualquier régimen de datos serio, que exige borrar los datos personales, no
reescribir la historia de terceros.

El mecanismo es el mismo borrado lógico que ya usa la fusión de invitados: la
fila queda marcada y nada queda huérfano.
"""

from datetime import datetime, timezone

from database import db
from storage_cloudinary import delete_image

NOMBRE_DE_BAJA = "Jugador dado de baja"

# El email se reemplaza por uno irrepetible en vez de borrarse. Dos razones: el
# índice único de `users.email` no acepta varios `null`, y liberar el email real
# permite que esa persona se vuelva a registrar más adelante si quiere.
DOMINIO_DE_BAJA = "cuenta-dada-de-baja.invalid"


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


async def anonimizar_cuenta(user_id: str, *, motivo: str = "propia") -> dict | None:
    """Da de baja una cuenta sin romper el historial de nadie.

    `motivo` distingue la baja que pide la persona de la que aplica un admin.
    Devuelve un resumen, o None si el usuario no existe.
    """
    usuario = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not usuario:
        return None

    if usuario.get("deleted_at"):
        return {"ya_estaba": True, "user_id": user_id}

    ahora = _ahora()
    perfil = await db.player_profiles.find_one({"user_id": user_id}, {"_id": 0})

    if perfil:
        # La foto sí se borra de verdad: es un dato personal que vive fuera de
        # nuestra base y no lo necesita nadie más.
        if perfil.get("photo_public_id"):
            await delete_image(perfil["photo_public_id"])

        await db.player_profiles.update_one(
            {"id": perfil["id"]},
            {
                "$set": {
                    "name": NOMBRE_DE_BAJA,
                    "email": None,
                    "photo_url": None,
                    "photo_public_id": None,
                    "birth_date": None,
                    "gender": None,
                    "deleted_at": ahora,
                }
            },
        )

        # Sale de los grupos: no tiene sentido que siga figurando en la lista de
        # nadie, ni que le lleguen partidos.
        await db.group_members.update_many(
            {"player_id": perfil["id"], "status": "activo"},
            {"$set": {"status": "inactivo"}},
        )

        # Y se da de baja de los partidos que todavía no se jugaron. Los ya
        # jugados NO se tocan: ahí estuvo, y borrarlo cambiaría el resultado de
        # los demás.
        await db.match_registrations.update_many(
            {
                "player_id": perfil["id"],
                "status": {"$ne": "baja"},
                "match_id": {"$in": await _partidos_por_jugar()},
            },
            {"$set": {"status": "baja", "removed_at": ahora, "removed_reason": "cuenta_dada_de_baja"}},
        )

    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "email": f"baja+{user_id}@{DOMINIO_DE_BAJA}",
                # Un hash imposible de producir con ninguna contraseña: la cuenta
                # no se puede reactivar adivinando nada.
                "password_hash": "!",
                "deleted_at": ahora,
                "deleted_reason": motivo,
                "verification_token": None,
            }
        },
    )

    return {
        "ya_estaba": False,
        "user_id": user_id,
        "profile_id": (perfil or {}).get("id"),
    }


async def _partidos_por_jugar() -> list[str]:
    """Los partidos que todavía no se jugaron, para darlo de baja sólo de esos."""
    abiertos = await db.matches.find(
        {"status": {"$in": ["abierto", "cerrado", "equipos_generados", "equipos_confirmados"]}},
        {"_id": 0, "id": 1},
    ).to_list(5000)
    return [m["id"] for m in abiertos]
