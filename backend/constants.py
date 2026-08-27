import math

# Género del jugador.
#
# Es un dato del perfil y ADEMÁS entra en el armado de equipos: el balanceador
# reparte cada género en partes iguales entre los dos equipos, así un partido
# mixto no termina con todas las mujeres de un lado.
#
# "prefiero_no_decir" existe para que el campo se pueda completar sin obligar a
# nadie a declarar nada. A los efectos del balanceo cae en la misma bolsa que
# quien todavía no lo cargó (ver GENDER_UNKNOWN en team_balancer).
GENDERS = [
    {"id": "masculino", "name": "Masculino"},
    {"id": "femenino", "name": "Femenino"},
    {"id": "otro", "name": "Otro"},
    {"id": "prefiero_no_decir", "name": "Prefiero no decir"},
]

GENDER_IDS = [g["id"] for g in GENDERS]
GENDER_MAP = {g["id"]: g for g in GENDERS}


POSITIONS = [
    {"id": "GK", "name": "Arquero", "zone": "defense"},
    {"id": "RB", "name": "Lateral derecho", "zone": "defense"},
    {"id": "CB", "name": "Zaguero/Central", "zone": "defense"},
    {"id": "LB", "name": "Lateral izquierdo", "zone": "defense"},
    {"id": "CDM", "name": "Volante central", "zone": "midfield"},
    {"id": "RM", "name": "Volante derecho", "zone": "midfield"},
    {"id": "LM", "name": "Volante izquierdo", "zone": "midfield"},
    {"id": "CAM", "name": "Enganche", "zone": "midfield"},
    {"id": "RW", "name": "Extremo derecho", "zone": "attack"},
    {"id": "LW", "name": "Extremo izquierdo", "zone": "attack"},
    {"id": "ST", "name": "Delantero centro", "zone": "attack"},
]

POSITION_IDS = [p["id"] for p in POSITIONS]
POSITION_MAP = {p["id"]: p for p in POSITIONS}

MODALITY_CAPACITY = {
    5: 10, 6: 12, 7: 14, 8: 16, 9: 18, 10: 20, 11: 22
}

FORMATIONS = {
    "4-4-2": ["GK", "RB", "CB", "CB", "LB", "RM", "CDM", "CDM", "LM", "ST", "ST"],
    "4-2-3-1": ["GK", "RB", "CB", "CB", "LB", "CDM", "CDM", "RW", "CAM", "LW", "ST"],
    "4-3-3": ["GK", "RB", "CB", "CB", "LB", "CDM", "CDM", "CAM", "RW", "LW", "ST"],
    "3-4-3": ["GK", "CB", "CB", "CB", "RM", "CDM", "CDM", "LM", "RW", "LW", "ST"],
    "5-3-2": ["GK", "RB", "CB", "CB", "CB", "LB", "CDM", "CDM", "CAM", "ST", "ST"],
    "3-5-2": ["GK", "CB", "CB", "CB", "RM", "CDM", "CDM", "CAM", "LM", "ST", "ST"],
    "4-5-1": ["GK", "RB", "CB", "CB", "LB", "RM", "CDM", "CDM", "LM", "CAM", "ST"],
}

# Pitch coordinates for each formation (x%, y% from top-left of vertical pitch)
FORMATION_COORDS = {
    "4-4-2": [
        {"pos": "GK", "x": 50, "y": 92},
        {"pos": "LB", "x": 15, "y": 72},
        {"pos": "CB", "x": 37, "y": 77},
        {"pos": "CB", "x": 63, "y": 77},
        {"pos": "RB", "x": 85, "y": 72},
        {"pos": "LM", "x": 15, "y": 48},
        {"pos": "CDM", "x": 37, "y": 53},
        {"pos": "CDM", "x": 63, "y": 53},
        {"pos": "RM", "x": 85, "y": 48},
        {"pos": "ST", "x": 37, "y": 22},
        {"pos": "ST", "x": 63, "y": 22},
    ],
    "4-2-3-1": [
        {"pos": "GK", "x": 50, "y": 92},
        {"pos": "LB", "x": 15, "y": 72},
        {"pos": "CB", "x": 37, "y": 77},
        {"pos": "CB", "x": 63, "y": 77},
        {"pos": "RB", "x": 85, "y": 72},
        {"pos": "CDM", "x": 37, "y": 57},
        {"pos": "CDM", "x": 63, "y": 57},
        {"pos": "LW", "x": 20, "y": 38},
        {"pos": "CAM", "x": 50, "y": 42},
        {"pos": "RW", "x": 80, "y": 38},
        {"pos": "ST", "x": 50, "y": 18},
    ],
    "4-3-3": [
        {"pos": "GK", "x": 50, "y": 92},
        {"pos": "LB", "x": 15, "y": 72},
        {"pos": "CB", "x": 37, "y": 77},
        {"pos": "CB", "x": 63, "y": 77},
        {"pos": "RB", "x": 85, "y": 72},
        {"pos": "CDM", "x": 50, "y": 57},
        {"pos": "CDM", "x": 33, "y": 50},
        {"pos": "CAM", "x": 67, "y": 50},
        {"pos": "LW", "x": 18, "y": 27},
        {"pos": "ST", "x": 50, "y": 20},
        {"pos": "RW", "x": 82, "y": 27},
    ],
    "3-4-3": [
        {"pos": "GK", "x": 50, "y": 92},
        {"pos": "CB", "x": 27, "y": 77},
        {"pos": "CB", "x": 50, "y": 75},
        {"pos": "CB", "x": 73, "y": 77},
        {"pos": "LM", "x": 15, "y": 50},
        {"pos": "CDM", "x": 37, "y": 55},
        {"pos": "CDM", "x": 63, "y": 55},
        {"pos": "RM", "x": 85, "y": 50},
        {"pos": "LW", "x": 20, "y": 25},
        {"pos": "ST", "x": 50, "y": 18},
        {"pos": "RW", "x": 80, "y": 25},
    ],
    "5-3-2": [
        {"pos": "GK", "x": 50, "y": 92},
        {"pos": "LB", "x": 10, "y": 70},
        {"pos": "CB", "x": 30, "y": 77},
        {"pos": "CB", "x": 50, "y": 75},
        {"pos": "CB", "x": 70, "y": 77},
        {"pos": "RB", "x": 90, "y": 70},
        {"pos": "CDM", "x": 30, "y": 50},
        {"pos": "CDM", "x": 50, "y": 48},
        {"pos": "CAM", "x": 70, "y": 50},
        {"pos": "ST", "x": 37, "y": 22},
        {"pos": "ST", "x": 63, "y": 22},
    ],
    "3-5-2": [
        {"pos": "GK", "x": 50, "y": 92},
        {"pos": "CB", "x": 27, "y": 77},
        {"pos": "CB", "x": 50, "y": 75},
        {"pos": "CB", "x": 73, "y": 77},
        {"pos": "LM", "x": 10, "y": 50},
        {"pos": "CDM", "x": 35, "y": 55},
        {"pos": "CDM", "x": 50, "y": 48},
        {"pos": "CAM", "x": 65, "y": 55},
        {"pos": "RM", "x": 90, "y": 50},
        {"pos": "ST", "x": 37, "y": 22},
        {"pos": "ST", "x": 63, "y": 22},
    ],
    "4-5-1": [
        {"pos": "GK", "x": 50, "y": 92},
        {"pos": "LB", "x": 15, "y": 72},
        {"pos": "CB", "x": 37, "y": 77},
        {"pos": "CB", "x": 63, "y": 77},
        {"pos": "RB", "x": 85, "y": 72},
        {"pos": "LM", "x": 15, "y": 48},
        {"pos": "CDM", "x": 35, "y": 55},
        {"pos": "CDM", "x": 65, "y": 55},
        {"pos": "RM", "x": 85, "y": 48},
        {"pos": "CAM", "x": 50, "y": 38},
        {"pos": "ST", "x": 50, "y": 18},
    ],
}

# ---------------------------------------------------------------------------
# Formaciones de los formatos que no son 11
# ---------------------------------------------------------------------------
#
# La app siempre aceptó modalidades de 5 a 10 (ver MODALITY_CAPACITY), pero las
# formaciones y la cancha existían SOLO para 11. O sea que el dibujo de la
# cancha, que es la pantalla más linda de la app, estaba reservado justo para el
# formato que menos se juega: un F5 mostraba nada más las listas de planteles.
#
# Acá se definen por LÍNEAS y no como una lista plana de puestos. El nombre de
# una formación ES su estructura de líneas, así que derivando una de la otra no
# pueden divergir: no existe la posibilidad de que "2-3-1" tenga cuatro
# defensores porque alguien editó la lista y no el nombre.
#
# El arquero no se escribe: lo lleva toda formación y repetirlo siete veces sólo
# da lugar a que en alguna falte.
_LINEAS_POR_MODALIDAD = {
    5: {
        "1-2-1": [["CB"], ["RM", "LM"], ["ST"]],
        "2-1-1": [["CB", "CB"], ["CDM"], ["ST"]],
        "1-1-2": [["CB"], ["CDM"], ["RW", "LW"]],
    },
    6: {
        "2-2-1": [["CB", "CB"], ["RM", "LM"], ["ST"]],
        "1-3-1": [["CB"], ["RM", "CAM", "LM"], ["ST"]],
        "2-1-2": [["CB", "CB"], ["CDM"], ["RW", "LW"]],
    },
    7: {
        "2-3-1": [["CB", "CB"], ["RM", "CAM", "LM"], ["ST"]],
        "3-2-1": [["RB", "CB", "LB"], ["CDM", "CAM"], ["ST"]],
        "2-2-2": [["CB", "CB"], ["RM", "LM"], ["ST", "ST"]],
    },
    8: {
        "3-3-1": [["RB", "CB", "LB"], ["RM", "CDM", "LM"], ["ST"]],
        "3-2-2": [["RB", "CB", "LB"], ["CDM", "CAM"], ["RW", "LW"]],
        "2-3-2": [["CB", "CB"], ["RM", "CDM", "LM"], ["ST", "ST"]],
    },
    9: {
        "3-3-2": [["RB", "CB", "LB"], ["RM", "CDM", "LM"], ["ST", "ST"]],
        "4-3-1": [["RB", "CB", "CB", "LB"], ["RM", "CDM", "LM"], ["ST"]],
        "3-4-1": [["RB", "CB", "LB"], ["RM", "CDM", "CAM", "LM"], ["ST"]],
    },
    10: {
        "4-3-2": [["RB", "CB", "CB", "LB"], ["RM", "CDM", "LM"], ["ST", "ST"]],
        "3-4-2": [["RB", "CB", "LB"], ["RM", "CDM", "CAM", "LM"], ["ST", "ST"]],
        "4-4-1": [["RB", "CB", "CB", "LB"], ["RM", "CDM", "CDM", "LM"], ["ST"]],
    },
}

# Profundidad de cada línea según cuántas haya, en % desde arriba de una cancha
# vertical. El arquero va fijo en 92, igual que en las formaciones de 11.
_Y_POR_CANTIDAD_DE_LINEAS = {
    2: [70, 32],
    3: [75, 50, 25],
    4: [78, 58, 38, 20],
}

# Reparto horizontal de una línea según cuántos jugadores tenga. Los extremos no
# llegan a 0 ni a 100 a propósito: la ficha del jugador se dibuja centrada en su
# coordenada y contra el borde quedaría cortada.
_X_POR_CANTIDAD = {
    1: [50],
    2: [33, 67],
    3: [20, 50, 80],
    4: [15, 38, 62, 85],
    5: [10, 30, 50, 70, 90],
}

GOALKEEPER_COORD = {"pos": "GK", "x": 50, "y": 92}


def _coords_de_lineas(lineas: list) -> list:
    """Coordenadas de una formación a partir de sus líneas. El arquero va primero."""
    profundidades = _Y_POR_CANTIDAD_DE_LINEAS[len(lineas)]
    coords = [dict(GOALKEEPER_COORD)]
    for linea, y in zip(lineas, profundidades):
        for pos, x in zip(linea, _X_POR_CANTIDAD[len(linea)]):
            coords.append({"pos": pos, "x": x, "y": y})
    return coords


def _puestos_de_lineas(lineas: list) -> list:
    return ["GK"] + [pos for linea in lineas for pos in linea]


# Las de 11 NO se generan: son las de arriba, ajustadas a mano una por una.
# Regenerarlas movería de lugar a los jugadores en partidos que ya existen, sin
# ningún beneficio a cambio.
FORMATIONS_BY_MODALITY = {
    modalidad: {nombre: _puestos_de_lineas(lineas) for nombre, lineas in formaciones.items()}
    for modalidad, formaciones in _LINEAS_POR_MODALIDAD.items()
}
FORMATIONS_BY_MODALITY[11] = FORMATIONS

FORMATION_COORDS_BY_MODALITY = {
    modalidad: {nombre: _coords_de_lineas(lineas) for nombre, lineas in formaciones.items()}
    for modalidad, formaciones in _LINEAS_POR_MODALIDAD.items()
}
FORMATION_COORDS_BY_MODALITY[11] = FORMATION_COORDS


def formaciones_de(modality: int) -> dict:
    """Formaciones de una modalidad. Dict vacío si no hay (nunca revienta)."""
    return FORMATIONS_BY_MODALITY.get(modality, {})


def coords_de(modality: int, formation: str | None) -> list:
    """Coordenadas de una formación concreta. Lista vacía si no existe."""
    if not formation:
        return []
    return FORMATION_COORDS_BY_MODALITY.get(modality, {}).get(formation, [])


GUEST_TO_REGULAR_THRESHOLD = 4

MATCH_STATUSES = [
    "abierto",
    "cerrado",
    "equipos_generados",
    "equipos_confirmados",
    "finalizado",
    "completado",
    # Estuvo faltando mucho tiempo: `cancelado` se escribe en cancel_match y el
    # front lo pinta desde siempre, pero el catálogo no lo nombraba. Un catálogo
    # que no incluye un valor que la base ya tiene no es un catálogo.
    "cancelado",
]

# A qué estados puede pasar un partido desde cada estado.
#
# Esto existe porque durante mucho tiempo las rutas escribían el estado nuevo
# sin mirar nunca el actual, y eso permitía dos cosas que no pasan en la
# realidad: un partido finalizado volviendo a "cerrado" (y reabriendo los seis
# endpoints de post-partido sobre datos ya cargados), y un partido abierto
# saltando a "completado" con gente todavía anotándose.
#
# La tabla describe la máquina COMPLETA, pero no todas las rutas la consultan
# todavía: `finalize` y `cancel` traen sus propias guardas escritas a mano desde
# antes, y hacen lo mismo. Cuando se unifiquen, el lugar es éste.
#
# Los estados terminales tienen lista vacía a propósito: un partido completado o
# cancelado no va a ningún lado.
# ---------------------------------------------------------------------------
# Roles y estados que NO tenían catálogo
# ---------------------------------------------------------------------------
#
# Modo, tipo y asistencia tienen catálogo acá y un `Literal` en models.py que un
# `assert` mantiene sincronizado, así que agregar un valor nuevo es imposible de
# hacer mal. Estos cuatro no lo tenían: las listas estaban escritas a mano en
# ocho lugares distintos y nadie las hablaba entre sí.
#
# OJO CON LA PALABRA "ORGANIZADOR". Hay dos ejes de rol y usan el mismo nombre
# para cosas distintas:
#
#   users.role                → admin | jugador          (quién sos en la app)
#   group_members.member_role → organizador | frecuente | invitado
#                                                        (qué podés hacer EN ESE GRUPO)
#
# El backend siempre autorizó por el segundo, que es el correcto: alguien puede
# organizar un grupo y ser jugador común en otro. Que los dos ejes compartieran
# la palabra es lo que llevó al front a leer el equivocado.
GROUP_MEMBER_ROLES = [
    {
        "id": "organizador",
        "name": "Organizador",
        "description": "Administra el grupo: invita, cambia roles, crea partidos.",
        "puede_organizar": True,
        "puede_calificar": True,
    },
    {
        "id": "frecuente",
        "name": "Jugador frecuente",
        "description": "Juega seguido. Puede calificar a sus compañeros.",
        "puede_organizar": False,
        "puede_calificar": True,
    },
    {
        "id": "invitado",
        "name": "Invitado",
        "description": "Lo sumó alguien para una fecha suelta.",
        "puede_organizar": False,
        "puede_calificar": False,
    },
]

GROUP_MEMBER_ROLE_IDS = [r["id"] for r in GROUP_MEMBER_ROLES]
GROUP_MEMBER_ROLE_MAP = {r["id"]: r for r in GROUP_MEMBER_ROLES}

DEFAULT_GROUP_MEMBER_ROLE = "frecuente"

# Estado de una inscripción a un partido. "baja" es un borrado lógico: la fila
# queda para saber que la persona estuvo anotada y se dio de baja.
REGISTRATION_STATUSES = ["titular", "suplente", "baja"]

# Estado de una membresía. "inactivo" es el equivalente para los grupos.
MEMBERSHIP_STATUSES = ["activo", "inactivo"]

# Una generación de equipos nace en borrador y se confirma.
TEAM_GENERATION_STATUSES = ["borrador", "confirmado"]


def rol_de_grupo(member_role: str | None) -> dict:
    """El rol de grupo, con default para las membresías viejas sin el campo."""
    return GROUP_MEMBER_ROLE_MAP.get(member_role or DEFAULT_GROUP_MEMBER_ROLE, GROUP_MEMBER_ROLE_MAP[DEFAULT_GROUP_MEMBER_ROLE])


def puede_organizar(member_role: str | None) -> bool:
    """Si este rol de grupo administra el grupo y crea partidos en él."""
    return rol_de_grupo(member_role)["puede_organizar"]


def puede_calificar(member_role: str | None) -> bool:
    """Si este rol de grupo puede ponerle puntaje a sus compañeros."""
    return rol_de_grupo(member_role)["puede_calificar"]


TRANSICIONES_PARTIDO = {
    "abierto": ["cerrado", "cancelado"],
    "cerrado": ["equipos_generados", "finalizado", "cancelado"],
    # Volver a "cerrado" desde los equipos no es un retroceso raro: es lo que
    # hace quitar a un anotado, que invalida los equipos ya armados.
    "equipos_generados": ["equipos_confirmados", "cerrado", "finalizado", "cancelado"],
    "equipos_confirmados": ["cerrado", "finalizado", "cancelado"],
    "finalizado": ["completado"],
    "completado": [],
    "cancelado": [],
}


# ---------------------------------------------------------------------------
# Modos de partido
# ---------------------------------------------------------------------------
#
# Un modo es un PRESET, no un camino aparte en el código. Los cinco se expanden
# a las MISMAS capacidades con valores distintos, y el resto de la app pregunta
# siempre por la capacidad ("¿este partido arma los equipos solo?") y nunca por
# el nombre del modo ("¿es pro?"). Es la diferencia entre siete banderas y cinco
# variantes de cada pantalla.
#
# Se nota mirando "avanzado" y "pro": difieren SÓLO en las estadísticas. Son el
# mismo camino con la lista vacía o no. Siguen separados acá porque como preset
# comunican cosas distintas al que crea el partido, no porque el código los trate
# distinto.
#
# Las capacidades, una por una:
#
#   team_source          ninguno | algoritmo | manual
#                        De dónde salen los equipos: de ningún lado (nadie los
#                        arma), del balanceador, o los elige un DT a mano.
#   opponent             interno | externo
#                        Si se juega A contra B entre los anotados, o nosotros
#                        contra un rival que no está en la app.
#   usa_puntajes         Si los jugadores tienen puntaje (inicial y/o evaluado).
#   rating_por_partido   Si se evalúa fecha a fecha (evaluaciones entre pares).
#   stats_configurables  Si el organizador elige qué estadísticas seguir.
#   stats_source         ninguno | consenso | organizador
#                        Quién confirma las estadísticas. El consenso (votación
#                        de los que jugaron) no escala cuando son muchas stats:
#                        ahí las carga el organizador y quedan firmes al guardar.
#   tiene_banco          Si la alineación distingue titulares de suplentes.
#                        OJO: es la ALINEACIÓN, no la inscripción. Un "suplente"
#                        de match_registrations es alguien que no entró en el
#                        cupo; un suplente del banco es alguien de mi equipo que
#                        va a entrar. Son cosas distintas, y por eso viven en
#                        lugares distintos.
#
# Los nombres visibles no son los técnicos. "Pro" y "Avanzado" no le dicen nada
# al que organiza el partido del martes: cada modo se llama por lo que pasa.
MATCH_MODES = [
    {
        "id": "diversion",
        "name": "Sólo anotarse",
        "description": "La gente se anota y al final cargás el resultado. Nada más.",
        "available": True,
        "capabilities": {
            "team_source": "ninguno",
            "opponent": "interno",
            "usa_puntajes": False,
            "rating_por_partido": False,
            "stats_configurables": False,
            "stats_source": "ninguno",
            "tiene_banco": False,
        },
    },
    {
        "id": "basico",
        "name": "Equipos armados",
        "description": "Con el puntaje inicial armamos los equipos. Después cargás el resultado.",
        "available": True,
        "capabilities": {
            "team_source": "algoritmo",
            "opponent": "interno",
            "usa_puntajes": True,
            "rating_por_partido": False,
            "stats_configurables": False,
            "stats_source": "ninguno",
            "tiene_banco": False,
        },
    },
    {
        "id": "avanzado",
        "name": "Con puntajes",
        "description": "Además se evalúan fecha a fecha, y los equipos van mejorando solos.",
        "available": True,
        "capabilities": {
            "team_source": "algoritmo",
            "opponent": "interno",
            "usa_puntajes": True,
            "rating_por_partido": True,
            "stats_configurables": False,
            "stats_source": "consenso",
            "tiene_banco": False,
        },
    },
    {
        "id": "pro",
        "name": "Con estadísticas",
        "description": "Lo anterior más las estadísticas que vos elijas seguir.",
        "available": True,
        "capabilities": {
            "team_source": "algoritmo",
            "opponent": "interno",
            "usa_puntajes": True,
            "rating_por_partido": True,
            "stats_configurables": True,
            "stats_source": "organizador",
            "tiene_banco": False,
        },
    },
    {
        "id": "entrenador",
        "name": "Equipo con DT",
        "description": "Para jugar contra otro equipo: vos elegís los titulares y el banco.",
        "available": True,
        "capabilities": {
            "team_source": "manual",
            "opponent": "externo",
            "usa_puntajes": True,
            "rating_por_partido": True,
            "stats_configurables": True,
            "stats_source": "organizador",
            "tiene_banco": True,
        },
    },
]

MATCH_MODE_IDS = [m["id"] for m in MATCH_MODES]
MATCH_MODE_MAP = {m["id"]: m for m in MATCH_MODES}

# Los que se pueden elegir hoy. Un modo que existe en el catálogo pero todavía no
# tiene sus pantallas se muestra como "próximamente" y el backend lo rechaza: es
# preferible un error claro al crear que un partido en un estado del que no se
# puede salir.
AVAILABLE_MATCH_MODE_IDS = [m["id"] for m in MATCH_MODES if m.get("available", True)]


def modo_disponible(mode: str | None) -> bool:
    modo = MATCH_MODE_MAP.get(mode)
    return bool(modo and modo.get("available", True))

# El default es "avanzado" y no "basico" porque es EXACTAMENTE lo que la app
# hacía antes de que existieran los modos: equipos automáticos, evaluación entre
# pares y estadísticas por consenso. Así los partidos que ya existen y los que se
# creen sin elegir nada se comportan igual que siempre.
DEFAULT_MATCH_MODE = "avanzado"


def capacidades_de(mode: str | None) -> dict:
    """Capacidades de un modo. Las del default si el modo no existe o falta.

    Nunca revienta y nunca devuelve vacío: quien la llama va a escribir
    `capacidades["usa_puntajes"]` sin un `.get()` de por medio, y un partido
    viejo sin modo tiene que seguir funcionando igual.
    """
    modo = MATCH_MODE_MAP.get(mode) or MATCH_MODE_MAP[DEFAULT_MATCH_MODE]
    return dict(modo["capabilities"])


def modo_label(mode: str | None) -> str:
    """Nombre visible de un modo, para no repetir el mapa en cada respuesta."""
    modo = MATCH_MODE_MAP.get(mode) or MATCH_MODE_MAP[DEFAULT_MATCH_MODE]
    return modo["name"]


# ---------------------------------------------------------------------------
# Tipo de partido: oficial o práctica
# ---------------------------------------------------------------------------
#
# Es un eje INDEPENDIENTE del modo: una práctica puede ser modo Pro, y un oficial
# puede ser modo Básico. Sirve para poder trazar al jugador que la rompe en los
# informales y en los oficiales no aparece.
#
# Son dos y no tres (no hay "amistoso") porque la gracia es comparar dos
# poblaciones, y una tercera categoría parte la muestra en tres justo cuando el
# problema de fondo es que en fútbol amateur nunca hay partidos de sobra.
#
# `rating_weight` es cuánto pesa cada tipo en el puntaje del jugador. Todavía no
# lo consume nadie: lo va a usar el cálculo de rating, con el mismo mecanismo con
# el que hoy `rating_calculator` mezcla las evaluaciones de partido (1.0) con las
# iniciales del grupo (0.6). Vive acá y no allá para que se vea que es una
# convención y no una ley del fútbol.
MATCH_TYPES = [
    {
        "id": "oficial",
        "name": "Oficial",
        "description": "Cuenta como partido en serio.",
        "rating_weight": 1.0,
    },
    {
        "id": "practica",
        "name": "Práctica",
        "description": "Entrenamiento o informal. Pesa menos en el puntaje.",
        "rating_weight": 0.7,
    },
]

MATCH_TYPE_IDS = [t["id"] for t in MATCH_TYPES]
MATCH_TYPE_MAP = {t["id"]: t for t in MATCH_TYPES}
DEFAULT_MATCH_TYPE = "oficial"


def tipo_label(match_type: str | None) -> str:
    tipo = MATCH_TYPE_MAP.get(match_type) or MATCH_TYPE_MAP[DEFAULT_MATCH_TYPE]
    return tipo["name"]


def peso_de_tipo(match_type: str | None) -> float:
    """Cuánto pesa un partido de este tipo en el puntaje del jugador.

    Los dos tipos alimentan el rating; lo que cambia es cuánto. Una práctica no
    se descarta — sería tirar la mitad de la evidencia de un equipo que entrena
    dos veces por semana — pero tampoco vale lo mismo que un partido en serio.
    """
    tipo = MATCH_TYPE_MAP.get(match_type) or MATCH_TYPE_MAP[DEFAULT_MATCH_TYPE]
    return float(tipo["rating_weight"])


# ---------------------------------------------------------------------------
# Estadísticas que se pueden seguir
# ---------------------------------------------------------------------------
#
# Antes eran tres columnas fijas (goals, assists, saves) escritas a mano en seis
# lugares: dos colecciones, el modelo del pedido, el del perfil, el cálculo del
# bonus y el formulario del front. Agregar "cortes" eran seis ediciones y la
# garantía de que la séptima quedaba afuera. Ahora son un catálogo, y el valor
# guardado es un dict.
#
# `bonus_weight` es cuánto pesa esa estadística en el puntaje del jugador, por
# partido. Los tres primeros conservan EXACTAMENTE los pesos que estaban
# hardcodeados en rating_calculator (0.3 / 0.2 / 0.15) para que ningún historial
# ya cargado cambie de valor al migrar.
#
# El resto pesa CERO, y no es que falte completarlo:
#
#   Cortes, duelos y regates miden cuánto tocás la pelota, no qué tan bien
#   jugás. El que juega de 5 en un equipo que se defiende toda la tarde acumula
#   cortes por dónde le tocó pararse, no por ser mejor. Si eso sumara puntaje, el
#   balanceador terminaría armando equipos alrededor de una métrica de
#   exposición. Se guardan y se muestran porque al grupo le divierte y porque son
#   historia real del jugador; no tocan el puntaje.
#
#   Con las tarjetas y las faltas pasa algo parecido al revés, y ahí además
#   habría que decidir si restan — que es una conversación aparte, no un número
#   que uno mete de callado en una constante.
#
# `negative` es para la pantalla: una amarilla no se pinta como un logro.
# `position_dependent` marca las que dependen del puesto. Atajadas ya lo era
# antes de todo esto (un delantero con cero atajadas no es peor que un arquero
# con ocho) y su peso quedó como estaba para no cambiar el pasado, pero está
# anotado para cuando se normalice el bonus por puesto.
TRACKABLE_STATS = [
    {
        "id": "goals",
        "name": "Goles",
        "short": "G",
        "default": True,
        "bonus_weight": 0.3,
        "negative": False,
        "position_dependent": False,
    },
    {
        "id": "assists",
        "name": "Asistencias",
        "short": "A",
        "default": True,
        "bonus_weight": 0.2,
        "negative": False,
        "position_dependent": False,
    },
    {
        "id": "saves",
        "name": "Atajadas",
        "short": "At",
        "default": False,
        "bonus_weight": 0.15,
        "negative": False,
        "position_dependent": True,
    },
    {
        "id": "tackles",
        "name": "Cortes",
        "short": "C",
        "default": False,
        "bonus_weight": 0.0,
        "negative": False,
        "position_dependent": True,
    },
    {
        "id": "duels_won",
        "name": "Duelos ganados",
        "short": "D",
        "default": False,
        "bonus_weight": 0.0,
        "negative": False,
        "position_dependent": True,
    },
    {
        "id": "dribbles_won",
        "name": "Regates ganados",
        "short": "R",
        "default": False,
        "bonus_weight": 0.0,
        "negative": False,
        "position_dependent": True,
    },
    {
        "id": "key_passes",
        "name": "Pases clave",
        "short": "PC",
        "default": False,
        "bonus_weight": 0.0,
        "negative": False,
        "position_dependent": True,
    },
    {
        "id": "fouls",
        "name": "Faltas",
        "short": "F",
        "default": False,
        "bonus_weight": 0.0,
        "negative": True,
        "position_dependent": False,
    },
    {
        "id": "yellow_cards",
        "name": "Amarillas",
        "short": "TA",
        "default": False,
        "bonus_weight": 0.0,
        "negative": True,
        "position_dependent": False,
    },
    {
        "id": "red_cards",
        "name": "Rojas",
        "short": "TR",
        "default": False,
        "bonus_weight": 0.0,
        "negative": True,
        "position_dependent": False,
    },
]

TRACKABLE_STAT_IDS = [s["id"] for s in TRACKABLE_STATS]
TRACKABLE_STAT_MAP = {s["id"]: s for s in TRACKABLE_STATS}

# Las tres de siempre. Es lo que la app pedía antes de que las estadísticas se
# pudieran elegir, así que es lo que sigue usando el modo que no las configura
# (avanzado): un partido creado hoy en ese modo pide exactamente lo mismo que
# pedía ayer.
CLASSIC_TRACKED_STATS = ["goals", "assists", "saves"]

# Las que vienen tildadas cuando SÍ se pueden elegir. Dos, porque es lo que la
# enorme mayoría va a querer y porque una lista con diez tildes es una lista que
# nadie completa.
DEFAULT_TRACKED_STATS = [s["id"] for s in TRACKABLE_STATS if s["default"]]

# Techo del bonus por estadísticas dentro del puntaje. Estaba escrito como un
# `min(raw_bonus, 1.0)` suelto en el cálculo; vive acá porque ahora que las
# estadísticas se eligen, el techo es lo único que impide que un partido con
# ocho métricas prendidas pese distinto que uno con dos.
MAX_STATS_BONUS = 1.0


def stats_de(match: dict) -> list:
    """Qué estadísticas sigue este partido. Lista vacía si no sigue ninguna.

    Un partido viejo sin `tracked_stats` cae en las tres clásicas, que es lo que
    de hecho tiene cargado.
    """
    seguidas = match.get("tracked_stats")
    if seguidas is None:
        return list(CLASSIC_TRACKED_STATS)
    return [stat_id for stat_id in seguidas if stat_id in TRACKABLE_STAT_MAP]


def resolver_stats_seguidas(capacidades: dict, elegidas: list | None) -> list:
    """Las estadísticas que le corresponden a un partido según su modo.

    `elegidas` en None significa "no vino nada en el pedido" y se usa el default
    del modo. Una lista vacía SÍ es una elección: el organizador destildó todo y
    no quiere estadísticas.
    """
    if capacidades.get("stats_source") == "ninguno":
        return []
    if not capacidades.get("stats_configurables"):
        return list(CLASSIC_TRACKED_STATS)
    if elegidas is None:
        return list(DEFAULT_TRACKED_STATS)
    return [stat_id for stat_id in elegidas if stat_id in TRACKABLE_STAT_MAP]


def valores_de_stats(doc: dict) -> dict:
    """Los valores de una fila de estadísticas, venga del formato nuevo o del viejo.

    Nuevo: `{"values": {"goals": 2}}`. Viejo: `{"goals": 2, "assists": 0, ...}`
    como columnas sueltas. La migración de arranque pasa todo al formato nuevo,
    pero esto no depende de que haya corrido — y encima cubre el hueco entre el
    deploy y el arranque.

    Los ceros se descartan: guardar diez claves en cero por jugador para decir
    que no hizo nada es ruido, y `.get(id, 0)` del otro lado da lo mismo.
    """
    crudos = doc.get("values")
    if not isinstance(crudos, dict):
        crudos = {k: doc.get(k) for k in CLASSIC_TRACKED_STATS}

    limpios = {}
    for stat_id, valor in crudos.items():
        if stat_id not in TRACKABLE_STAT_MAP:
            continue
        try:
            entero = int(valor)
        except (TypeError, ValueError):
            continue
        if entero:
            limpios[stat_id] = entero
    return limpios


# ---------------------------------------------------------------------------
# El resultado como señal de puntaje
# ---------------------------------------------------------------------------
#
# Hasta acá el puntaje de un jugador salía SOLO de que otros lo calificaran. Eso
# tiene tres problemas conocidos: la política del grupo, la vagancia (nadie
# califica a trece personas del uno al diez) y el sesgo del que califica. Y uno
# peor: la app armaba equipos, decía "balance 0.97" y nunca se enteraba de si
# terminó 6 a 0.
#
# El resultado arregla las cuatro cosas. Es un número por partido que restringe a
# los veintidós a la vez, no se lo pide a nadie (ya se carga igual) y —lo más
# importante— es la ETIQUETA que el balanceador nunca tuvo: si dijo que estaban
# parejos y uno ganó por goleada, se equivocó, y ahora queda registrado.
#
# Cómo se convierte un resultado en puntaje:
#
#   1. Se calcula qué se ESPERABA, con la fuerza que tenía cada equipo cuando se
#      armaron (los `player_score` congelados en team_generations). No hay
#      circularidad: es lo que creíamos en ese momento, no lo que creemos ahora.
#   2. Se compara con lo que PASÓ (ganó, empató, perdió).
#   3. La diferencia — la sorpresa — es lo que mueve el puntaje. Ganarle a un
#      equipo más fuerte vale mucho; ganarle al que tenías que ganarle, casi nada.
#
# Un partido parejo (que es lo que el balanceador busca) da una expectativa de
# 0.5, y ahí el puntaje del resultado es básicamente "ganaste o perdiste". Que es
# exactamente lo correcto cuando los equipos estaban parejos.

# Cuánta diferencia de puntaje hace falta para que un equipo sea claramente
# favorito. Con 4.0, un equipo un punto mejor (en la escala de 0 a 10) gana el
# 64% de las veces. La escala de Elo original usa 400 sobre ratings de ~1500;
# acá los ratings van de 0 a 10, y 4.0 da una curva realista para fútbol amateur,
# donde el azar pesa mucho. Un valor más chico haría que el sistema se
# "sorprenda" poco y el resultado casi no moviera nada.
RESULT_ELO_SCALE = 4.0

# Cuánto puede mover el resultado de UN partido, como máximo. Con 4.0, ganarle a
# un equipo que te daba por perdido lleva el puntaje de ese partido a 9; perder
# siendo amplio favorito, a 1.
RESULT_SWING = 4.0

# El margen importa, pero poco y con techo. Un 10 a 0 no puede valer diez veces
# un 1 a 0: en fútbol amateur una goleada suele significar que faltaron dos y
# jugaron nueve contra once, no que un equipo sea diez veces mejor.
RESULT_MARGIN_STEP = 0.15
RESULT_MARGIN_CAP = 1.5

# Cuánto del puntaje del jugador puede venir del resultado, y qué tan rápido
# llega ahí. La proporción crece con la cantidad de partidos con resultado:
#
#   share = MAX * n / (n + HALF)
#
#   1 partido  -> 10%    4 partidos -> 25%
#   10         -> 36%    30         -> 44%
#
# El techo del 50% es a propósito. El resultado es una señal COMPARTIDA por diez
# a veintidós jugadores: el arquero que no tocó una pelota gana igual que el que
# hizo tres goles. Dejarla mandar sola convertiría el puntaje en "en qué equipo
# te tocó". La curva hace lo otro que importa: un solo partido mueve el 10% y no
# el 50, así que una goleada suelta no le arruina el puntaje a nadie.
RESULT_MAX_SHARE = 0.5
RESULT_EVIDENCE_HALF = 4.0


def probabilidad_esperada(mi_fuerza: float, fuerza_rival: float) -> float:
    """Qué chance tenía mi equipo, según cómo estaban armados. Entre 0 y 1."""
    return 1.0 / (1.0 + 10 ** ((fuerza_rival - mi_fuerza) / RESULT_ELO_SCALE))


def factor_de_margen(diferencia_de_gol: int) -> float:
    """Cuánto pesa el margen. Crece despacio y con techo (ver RESULT_MARGIN_CAP)."""
    margen = abs(int(diferencia_de_gol or 0))
    return min(RESULT_MARGIN_CAP, 1.0 + math.log2(1 + margen) * RESULT_MARGIN_STEP)


def resultado_real(goles_a_favor: int, goles_en_contra: int) -> float:
    """1.0 ganó, 0.5 empató, 0.0 perdió."""
    if goles_a_favor > goles_en_contra:
        return 1.0
    if goles_a_favor < goles_en_contra:
        return 0.0
    return 0.5


def puntaje_por_resultado(esperado: float, real: float, diferencia_de_gol: int) -> float:
    """El puntaje de 1 a 10 que se lleva un jugador por cómo salió el partido.

    Va en la misma escala que las evaluaciones entre pares a propósito: así entra
    al promedio del rating como un canal más y no como una unidad nueva que haya
    que traducir.

    El centro es 5.0 — el prior neutro del proyecto — y de ahí se mueve por la
    sorpresa. Un partido que salió exactamente como se esperaba deja el puntaje
    en 5 y por lo tanto no mueve nada, que es lo correcto: no aporta información.
    """
    sorpresa = real - esperado
    crudo = 5.0 + RESULT_SWING * sorpresa * factor_de_margen(diferencia_de_gol)
    return max(1.0, min(10.0, crudo))


def peso_del_resultado(cantidad_de_partidos: int) -> float:
    """Qué proporción del puntaje aporta el resultado. Ver RESULT_MAX_SHARE."""
    if cantidad_de_partidos <= 0:
        return 0.0
    n = float(cantidad_de_partidos)
    return RESULT_MAX_SHARE * n / (n + RESULT_EVIDENCE_HALF)


# ---------------------------------------------------------------------------
# Oficial contra práctica
# ---------------------------------------------------------------------------
#
# Poder decir "este jugador la rompe en las prácticas y en los oficiales no
# aparece" es de lo más útil que puede dar la app. También es la forma más fácil
# de vender ruido como si fuera un dato.
#
# Con cuatro partidos oficiales, la diferencia entre un promedio y el otro es
# casi siempre azar. Y esa frase, en un grupo de amigos, no es una estadística:
# es una acusación. Así que hay dos frenos:
#
#   1. La comparación no se MUESTRA hasta que haya SPLIT_MIN_MATCHES de cada
#      tipo. Antes de eso la app dice cuántos faltan, que además engancha.
#   2. Cada promedio se encoge hacia el rating general del jugador con
#      SPLIT_SHRINK_K. Sólo una diferencia que se sostiene en el tiempo
#      sobrevive; una racha de dos partidos se desarma sola.
SPLIT_MIN_MATCHES = 5
SPLIT_SHRINK_K = 5.0


def encoger_hacia(promedio: float, cantidad: int, referencia: float, k: float = SPLIT_SHRINK_K) -> float:
    """Acerca un promedio flaco a una referencia. Con muchos datos casi no lo toca."""
    if cantidad <= 0:
        return referencia
    confianza = cantidad / (cantidad + k)
    return promedio * confianza + referencia * (1 - confianza)


# ---------------------------------------------------------------------------
# Asistencia
# ---------------------------------------------------------------------------
#
# Anotarse no es venir. Hasta ahora finalizar el partido le sumaba un
# `matches_played` a todos los que figuraban como titulares, incluido el que
# nunca apareció — y ese contador es el que alimenta el índice de confianza del
# rating, así que el error se acumula callado.
#
# Que nadie haya marcado nada (`None`) NO es lo mismo que "faltó": significa que
# no se tomó asistencia, y ahí vale la regla vieja (titular = jugó). Sólo una
# marca explícita cambia el conteo.
#
# `ausente` y `sin_aviso` cuentan igual para el rating: los dos son "no jugó".
# Están separados porque la diferencia entre avisar y plantar es justamente el
# dato que al grupo le interesa ver.
# Rol de un jugador DENTRO de la alineación. Ojo con la palabra "suplente", que
# en esta app significa dos cosas distintas según dónde esté:
#
#   match_registrations.status = "suplente"  -> se llenó el cupo, está en lista
#                                               de espera y NO forma parte del
#                                               plantel del partido.
#   assignments[].role = "suplente"          -> es del equipo, está en el banco
#                                               y puede entrar.
#
# Son cosas distintas y por eso viven en lugares distintos. Meter el banco en la
# inscripción habría mezclado "no entraste al partido" con "arrancás afuera",
# que para el que las lee es lo mismo y para el sistema no.
LINEUP_ROLES = ["titular", "suplente"]
DEFAULT_LINEUP_ROLE = "titular"

ATTENDANCE_PRESENT = "presente"
# El `short` es para el control compacto que va al lado de cada jugador en la
# lista, donde "Avisó que no venía" no entra. El `name` completo viaja igual y se
# usa como etiqueta accesible, así el que navega con lector de pantalla escucha
# la diferencia entre avisar y plantar, que es justamente el dato que importa.
ATTENDANCE_STATUSES = [
    {"id": ATTENDANCE_PRESENT, "name": "Vino", "short": "Vino", "jugo": True},
    {"id": "ausente", "name": "Avisó que no venía", "short": "Avisó", "jugo": False},
    {"id": "sin_aviso", "name": "No vino ni avisó", "short": "Plantó", "jugo": False},
]

ATTENDANCE_IDS = [a["id"] for a in ATTENDANCE_STATUSES]
ATTENDANCE_MAP = {a["id"]: a for a in ATTENDANCE_STATUSES}


def jugo_el_partido(registration: dict) -> bool:
    """Si una inscripción cuenta como partido jugado.

    La marca explícita manda. Sin marca vale la regla vieja: el titular jugó, el
    suplente no. Así un partido al que nadie le tomó asistencia sigue contando
    exactamente como contaba antes de que la asistencia existiera.
    """
    marca = registration.get("attendance")
    if marca in ATTENDANCE_MAP:
        return ATTENDANCE_MAP[marca]["jugo"]
    return registration.get("status") == "titular"


# Torneos: un torneo agrupa GRUPOS existentes, cada grupo juega como un equipo.
TOURNAMENT_FORMATS = [
    {
        "id": "liga",
        "name": "Liga",
        "description": "Todos contra todos, una rueda. Gana el de más puntos.",
    },
    {
        "id": "zonas_eliminatoria",
        "name": "Zonas + eliminatoria",
        "description": "Fase de grupos por zonas y después llaves de eliminación directa.",
    },
    {
        "id": "eliminacion",
        "name": "Eliminación directa",
        "description": "Llaves tipo copa: el que pierde queda afuera.",
    },
]

TOURNAMENT_FORMAT_IDS = [f["id"] for f in TOURNAMENT_FORMATS]
TOURNAMENT_FORMAT_MAP = {f["id"]: f for f in TOURNAMENT_FORMATS}

TOURNAMENT_STATUSES = ["borrador", "fase_grupos", "eliminatoria", "finalizado"]

# Puntaje de la tabla. Están acá y no hardcodeados en el cálculo para que se vea
# de una que son una convención y no una ley del fútbol.
POINTS_WIN = 3
POINTS_DRAW = 1
POINTS_LOSS = 0

# Nombre de cada ronda de llaves según cuántos equipos entren a esa ronda.
KNOCKOUT_ROUND_NAMES = {
    2: "final",
    4: "semifinal",
    8: "cuartos",
    16: "octavos",
    32: "dieciseisavos",
}

KNOCKOUT_ROUND_LABELS = {
    "final": "Final",
    "semifinal": "Semifinal",
    "cuartos": "Cuartos de final",
    "octavos": "Octavos de final",
    "dieciseisavos": "Dieciseisavos de final",
}
