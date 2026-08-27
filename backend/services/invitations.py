"""
Invitación a un grupo por link.

Hasta ahora la única forma de entrar a un grupo era que un organizador te
agregara a mano, buscándote por email. Eso dejaba dos agujeros: el que se
registraba por su cuenta no tenía ninguna puerta, y el link del partido que se
comparte por WhatsApp —el mecanismo social del producto— le devolvía un 403 a
quien no fuera del grupo.

DECISIONES QUE VALE TENER ESCRITAS:

- **El link ES el secreto.** No hay aprobación previa: quien lo abre entra. Un
  paso de aprobación agrega fricción justo en el momento en que la persona
  tiene ganas de entrar, y el organizador puede sacar a cualquiera después. Es
  el mismo trato que ya hace cualquier grupo de WhatsApp.

- **Un solo link vivo por grupo.** Rotar revoca el anterior, que es lo que se
  quiere cuando el link se filtró. Tener varios activos suena flexible y en la
  práctica sólo hace imposible contestar "¿quién tiene acceso?".

- **El token no es el id del grupo.** Si lo fuera, cualquiera que viera un
  `group_id` en una respuesta de la API podría meterse solo.

- **Entra como `frecuente`, nunca como organizador.** Un link filtrado no puede
  regalar la administración del grupo.
"""

from datetime import datetime, timezone
import secrets
import uuid

from database import db

# 32 caracteres url-safe. `token_urlsafe(24)` da ~192 bits de entropía: adivinar
# uno por fuerza bruta no es un ataque, es un pasatiempo.
LARGO_DEL_TOKEN = 24


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


async def invitacion_vigente(group_id: str) -> dict | None:
    """El link activo del grupo, si hay uno."""
    return await db.group_invitations.find_one(
        {"group_id": group_id, "revoked_at": None}, {"_id": 0}
    )


async def crear_invitacion(group_id: str, creador_id: str, *, rotar: bool = False) -> dict:
    """Devuelve el link vigente del grupo, creándolo si no había.

    Con `rotar`, revoca el anterior y emite uno nuevo: es lo que se hace cuando
    el link se filtró y hay que cortar el acceso de quien lo tenga guardado.
    """
    vigente = await invitacion_vigente(group_id)
    if vigente and not rotar:
        return vigente

    if vigente:
        await db.group_invitations.update_one(
            {"id": vigente["id"]}, {"$set": {"revoked_at": _ahora()}}
        )

    invitacion = {
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "token": secrets.token_urlsafe(LARGO_DEL_TOKEN),
        "created_by": creador_id,
        "created_at": _ahora(),
        "revoked_at": None,
        # Cuánta gente entró con este link. No identifica a nadie: es para que el
        # organizador pueda ver si vale la pena rotarlo.
        "usos": 0,
    }
    await db.group_invitations.insert_one(invitacion)
    return {k: v for k, v in invitacion.items() if k != "_id"}


async def revocar_invitacion(group_id: str) -> bool:
    """Corta el link sin emitir uno nuevo. El grupo queda cerrado otra vez."""
    resultado = await db.group_invitations.update_many(
        {"group_id": group_id, "revoked_at": None},
        {"$set": {"revoked_at": _ahora()}},
    )
    return resultado.modified_count > 0


async def buscar_por_token(token: str) -> dict | None:
    """La invitación viva con este token."""
    if not token:
        return None
    return await db.group_invitations.find_one(
        {"token": token, "revoked_at": None}, {"_id": 0}
    )


async def registrar_uso(invitacion_id: str) -> None:
    await db.group_invitations.update_one({"id": invitacion_id}, {"$inc": {"usos": 1}})
