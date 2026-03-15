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

GUEST_TO_REGULAR_THRESHOLD = 4

MATCH_STATUSES = [
    "abierto",
    "cerrado",
    "equipos_generados",
    "equipos_confirmados",
    "finalizado",
    "completado",
]
