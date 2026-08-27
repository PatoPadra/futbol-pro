"""
Las dos rutas que ve quien RECIBE una invitación.

Van en su propio prefijo y no bajo `/api/groups` a propósito: quien abre el link
todavía no pertenece al grupo, así que colgarlas del grupo obligaría a que la
ruta acepte a un no-miembro en un lugar donde todo lo demás lo rechaza. Y de
paso evita cualquier ambigüedad de ruteo con `/api/groups/{group_id}`.
"""

from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from constants import DEFAULT_GROUP_MEMBER_ROLE
from database import db
from models import InvitacionDeGrupo
from services.invitations import buscar_por_token, registrar_uso
from services.profiles import get_my_profile_or_404

router = APIRouter(prefix="/api/invitations", tags=["invitations"])


async def _invitacion_o_404(token: str) -> dict:
    invitacion = await buscar_por_token(token)
    if not invitacion:
        raise HTTPException(
            status_code=404,
            detail="Este link de invitación ya no sirve. Pedile uno nuevo al organizador.",
        )
    return invitacion


async def _grupo_o_404(group_id: str) -> dict:
    grupo = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not grupo:
        # El link vive, pero el grupo se borró. Para el que abre es lo mismo.
        raise HTTPException(status_code=404, detail="Ese grupo ya no existe")
    return grupo


@router.get("/{token}", response_model=InvitacionDeGrupo)
async def ver_invitacion(token: str, user=Depends(get_current_user)):
    """Qué grupo es, antes de entrar.

    Existe para que nadie entre a ciegas: el link dice a qué grupo te suma y
    quién te invitó. Y si ya sos miembro, lo dice en vez de ofrecerte entrar de
    nuevo — así la pantalla te lleva derecho al grupo.
    """
    invitacion = await _invitacion_o_404(token)
    grupo = await _grupo_o_404(invitacion["group_id"])
    profile = await get_my_profile_or_404(user)

    membresia = await db.group_members.find_one(
        {"group_id": grupo["id"], "player_id": profile["id"], "status": "activo"},
        {"_id": 0, "id": 1},
    )

    invitador = await db.player_profiles.find_one(
        {"id": invitacion.get("created_by")}, {"_id": 0, "name": 1}
    )
    miembros = await db.group_members.count_documents(
        {"group_id": grupo["id"], "status": "activo"}
    )

    return InvitacionDeGrupo(
        token=token,
        group_id=grupo["id"],
        group_name=grupo["name"],
        invitado_por=(invitador or {}).get("name"),
        ya_soy_miembro=bool(membresia),
        miembros=miembros,
    )


@router.post("/{token}/accept")
async def aceptar_invitacion(token: str, user=Depends(get_current_user)):
    """Entra al grupo.

    Sin aprobación previa: el link es el secreto. Y siempre como `frecuente`,
    nunca como organizador — un link filtrado no puede regalar la
    administración del grupo.
    """
    invitacion = await _invitacion_o_404(token)
    grupo = await _grupo_o_404(invitacion["group_id"])
    profile = await get_my_profile_or_404(user)

    ahora = datetime.now(timezone.utc).isoformat()

    existente = await db.group_members.find_one(
        {"group_id": grupo["id"], "player_id": profile["id"]}, {"_id": 0}
    )
    if existente:
        if existente.get("status") == "activo":
            return {
                "message": f"Ya sos parte de {grupo['name']}",
                "group_id": grupo["id"],
                "ya_estaba": True,
            }
        # Volvió alguien que se había ido: se reactiva la membresía que ya
        # existe en vez de insertar otra. Es lo que hace `add_group_member`, y
        # además es lo único compatible con el índice único de (grupo, jugador).
        await db.group_members.update_one(
            {"id": existente["id"]},
            {"$set": {"status": "activo", "rejoined_at": ahora}},
        )
    else:
        await db.group_members.insert_one({
            "id": str(uuid.uuid4()),
            "group_id": grupo["id"],
            "player_id": profile["id"],
            "member_role": DEFAULT_GROUP_MEMBER_ROLE,
            "status": "activo",
            "invited_by": invitacion.get("created_by"),
            "joined_via": "link",
            "created_at": ahora,
        })

    await registrar_uso(invitacion["id"])

    return {
        "message": f"Entraste a {grupo['name']}",
        "group_id": grupo["id"],
        "ya_estaba": False,
    }
