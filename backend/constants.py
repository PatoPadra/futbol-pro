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
]


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
