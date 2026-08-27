"""
Tests de los catálogos que no tenían catálogo, y de la forma de los índices.

Modo, tipo y asistencia se protegían con un `assert` que compara el `Literal` de
Pydantic contra la lista de `constants.py`, así que agregar un valor en un solo
lado hace que la app no arranque. Cuatro ejes no tenían nada: el rol dentro del
grupo, el estado de una inscripción, el de una membresía y el de una generación
de equipos. Sus listas estaban escritas a mano en ocho lugares.

El peor de los cuatro era `member_role`, porque hay DOS ejes de rol que usan la
palabra "organizador" para cosas distintas —`users.role` y
`group_members.member_role`— y sin catálogo nada impedía que cada capa leyera el
que quisiera. El front terminó leyendo el equivocado.

La segunda mitad del archivo mira `INDEX_SPEC`. Un índice mal declarado no
rompe nada al arrancar: `ensure_indexes` loguea y sigue. O sea que una garantía
de unicidad puede no existir mientras todos creen que sí, y eso se descubre
cuando ya hay datos duplicados.
"""

import pytest
from pydantic import ValidationError

from constants import (
    GROUP_MEMBER_ROLE_IDS,
    MATCH_STATUSES,
    MEMBERSHIP_STATUSES,
    REGISTRATION_STATUSES,
    TEAM_GENERATION_STATUSES,
    TRANSICIONES_PARTIDO,
    puede_calificar,
    puede_organizar,
)
from database import INDEX_SPEC
from models import UpdateGroupMemberRequest


# --------------------------------------------------------------------- #
# Los catálogos
# --------------------------------------------------------------------- #

def test_los_asserts_de_coherencia_corren_al_importar():
    """Si `models.py` importó, los Literal y los catálogos coinciden.

    El assert vive en el módulo a propósito: convierte un bug de datos —un modo
    o un rol que existe de un lado y no del otro— en un fallo de arranque, que
    es infinitamente mejor que enterarse tres pantallas después con documentos
    ya guardados.
    """
    import models  # noqa: F401

    assert set(GROUP_MEMBER_ROLE_IDS) == {"organizador", "frecuente", "invitado"}
    assert set(REGISTRATION_STATUSES) == {"titular", "suplente", "baja"}
    assert set(MEMBERSHIP_STATUSES) == {"activo", "inactivo"}
    assert set(TEAM_GENERATION_STATUSES) == {"borrador", "confirmado"}


def test_quien_organiza_y_quien_califica():
    assert puede_organizar("organizador") is True
    assert puede_organizar("frecuente") is False
    assert puede_organizar("invitado") is False

    assert puede_calificar("organizador") is True
    assert puede_calificar("frecuente") is True
    assert puede_calificar("invitado") is False


def test_una_membresia_vieja_sin_rol_cae_en_frecuente():
    """No organiza, pero tampoco pierde lo que podía hacer antes."""
    assert puede_organizar(None) is False
    assert puede_calificar(None) is True


def test_un_rol_inventado_no_organiza():
    """El default es el rol MENOS poderoso de los que califican, no el más."""
    assert puede_organizar("emperador") is False


# --------------------------------------------------------------------- #
# El endpoint que recibía un dict crudo
# --------------------------------------------------------------------- #

def test_no_se_puede_poner_un_rol_que_no_existe():
    with pytest.raises(ValidationError):
        UpdateGroupMemberRequest(member_role="emperador")


def test_no_se_puede_poner_un_estado_que_no_existe():
    with pytest.raises(ValidationError):
        UpdateGroupMemberRequest(status="jubilado")


def test_un_pedido_vacio_es_un_error_del_cliente():
    """Antes esto era un 400 escrito a mano; ahora es un 422 del framework."""
    with pytest.raises(ValidationError):
        UpdateGroupMemberRequest()


def test_alcanza_con_mandar_uno_de_los_dos():
    assert UpdateGroupMemberRequest(member_role="organizador").status is None
    assert UpdateGroupMemberRequest(status="inactivo").member_role is None


# --------------------------------------------------------------------- #
# La forma de INDEX_SPEC
# --------------------------------------------------------------------- #

def test_ninguna_coleccion_declara_dos_indices_con_las_mismas_claves():
    """Dos specs con el mismo patrón se pisan y el segundo nunca se crea.

    Mongo rechaza el duplicado con IndexOptionsConflict, `ensure_indexes` lo
    loguea y sigue, y el índice que alguien creyó agregar no existe.
    """
    for coleccion, specs in INDEX_SPEC.items():
        vistos = []
        for spec in specs:
            patron = tuple(spec["keys"])
            assert patron not in vistos, f"{coleccion} declara dos veces {patron}"
            vistos.append(patron)


# Los filtros parciales de Mongo aceptan un subconjunto chico del lenguaje de
# query. `$ne` NO está — y es justo el que uno escribe primero para decir
# "todas menos las bajas".
OPERADORES_VALIDOS_EN_PARCIAL = {"$eq", "$exists", "$gt", "$gte", "$lt", "$lte", "$type", "$and", "$or", "$in"}


def test_los_filtros_parciales_usan_solo_operadores_soportados():
    for coleccion, specs in INDEX_SPEC.items():
        for spec in specs:
            for campo, condicion in (spec.get("partial") or {}).items():
                if not isinstance(condicion, dict):
                    continue  # igualdad directa, siempre válida
                for operador in condicion:
                    assert operador in OPERADORES_VALIDOS_EN_PARCIAL, (
                        f"{coleccion}.{campo} usa {operador}, que Mongo no acepta "
                        "en partialFilterExpression: el índice no se va a crear"
                    )


def test_las_claves_de_unicidad_criticas_estan_declaradas():
    """Las que el diagnóstico mide como precondición tienen que existir acá.

    Si alguien saca una de estas de INDEX_SPEC, el script de diagnóstico sigue
    contando duplicados que ya nada impide.
    """
    def tiene_unico(coleccion, claves):
        return any(
            spec.get("unique") and [k for k, _ in spec["keys"]] == claves
            for spec in INDEX_SPEC[coleccion]
        )

    assert tiene_unico("player_profiles", ["user_id"])
    assert tiene_unico("group_members", ["group_id", "player_id"])
    assert tiene_unico("match_registrations", ["match_id", "player_id"])
    assert tiene_unico("users", ["email"])
    assert tiene_unico("team_generations", ["match_id"])


def test_el_unico_de_inscripciones_deja_afuera_a_las_bajas():
    """Darse de baja y volver a anotarse tiene que seguir siendo posible."""
    spec = next(
        s for s in INDEX_SPEC["match_registrations"]
        if s.get("unique") and [k for k, _ in s["keys"]] == ["match_id", "player_id"]
    )
    estados = spec["partial"]["status"]["$in"]
    assert "baja" not in estados
    assert set(estados) == set(REGISTRATION_STATUSES) - {"baja"}


def test_el_unico_de_perfiles_no_atrapa_a_los_invitados():
    """Los invitados tienen `user_id: None` EXPLÍCITO, no ausente.

    Por eso el filtro es por `$type` y no `sparse`: con sparse entrarían todos
    los invitados al índice y colisionarían entre ellos en el primer alta.
    """
    spec = next(
        s for s in INDEX_SPEC["player_profiles"]
        if s.get("unique") and [k for k, _ in s["keys"]] == ["user_id"]
    )
    assert spec.get("sparse") is not True
    assert spec["partial"] == {"user_id": {"$type": "string"}}


def test_toda_transicion_de_partido_nombra_estados_del_catalogo():
    for origen, destinos in TRANSICIONES_PARTIDO.items():
        assert origen in MATCH_STATUSES
        for destino in destinos:
            assert destino in MATCH_STATUSES


def test_todo_estado_del_catalogo_esta_en_la_tabla():
    """Un estado sin fila en la tabla no puede salir de ahí nunca más."""
    for estado in MATCH_STATUSES:
        assert estado in TRANSICIONES_PARTIDO, f"{estado} no tiene transiciones declaradas"


# --------------------------------------------------------------------- #
# El rol global, que quedo en dos
# --------------------------------------------------------------------- #

def test_el_rol_global_organizador_ya_no_existe():
    """Se fue porque no hacia nada util y le robaba el nombre al que si.

    El backend siempre autorizo por el rol DENTRO del grupo. Tener dos ejes con
    la palabra "organizador" significando cosas distintas es la causa raiz del
    bug de permisos que el front arrastro durante meses.
    """
    from constants import DEFAULT_USER_ROLE, LEGACY_USER_ROLE, USER_ROLE_IDS

    assert set(USER_ROLE_IDS) == {"admin", "jugador"}
    assert LEGACY_USER_ROLE not in USER_ROLE_IDS
    assert DEFAULT_USER_ROLE == "jugador"


def test_no_se_puede_asignar_un_rol_global_que_no_existe():
    from models import UpdateRoleRequest

    with pytest.raises(ValidationError):
        UpdateRoleRequest(role="organizador")


# --------------------------------------------------------------------- #
# El deadline
# --------------------------------------------------------------------- #

def test_el_deadline_sale_de_la_hora_del_partido():
    """Antes era mediodia UTC clavado: las 9 de la mañana en Argentina.

    Para un partido de las 20:00 la pantalla anunciaba el cierre once horas
    antes, mientras el backend —que nunca leyo el campo— seguia aceptando
    anotados.
    """
    from constants import deadline_de

    assert deadline_de("2026-09-05", "20:30") == "2026-09-05T20:30:00"
    assert "+00:00" not in deadline_de("2026-09-05", "20:30")


def test_un_partido_sin_hora_no_rompe_el_deadline():
    from constants import deadline_de

    assert deadline_de("2026-09-05", None) == "2026-09-05T00:00:00"
    assert deadline_de("2026-09-05", "") == "2026-09-05T00:00:00"


def test_el_indice_del_token_de_invitacion_es_unico():
    """El token es la llave de entrada al grupo."""
    spec = next(
        s for s in INDEX_SPEC["group_invitations"]
        if [k for k, _ in s["keys"]] == ["token"]
    )
    assert spec.get("unique") is True
