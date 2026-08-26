"""
Motor de torneos: reparto en zonas, generación de fixture, llaves y tabla.

Todo lo de acá es PURO: recibe listas de dicts y devuelve listas de dicts, no
toca Mongo. Es a propósito — el fixture y la tabla son la parte del torneo que
tiene reglas de verdad (quién juega contra quién, quién clasifica, cómo se
desempata) y poder probarla sin levantar una base es lo que hace que se pueda
tocar sin miedo. La persistencia vive entera en routes_tournaments.py.
"""

from constants import (
    KNOCKOUT_ROUND_LABELS,
    KNOCKOUT_ROUND_NAMES,
    POINTS_DRAW,
    POINTS_LOSS,
    POINTS_WIN,
)

# Nombre de las zonas: A, B, C… Con más de 8 zonas esto ya no es el torneo de
# un grupo de amigos, así que el tope está acá y no en una config.
ZONE_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"]
MAX_ZONES = len(ZONE_NAMES)


def stage_label(stage: str, zone: str | None = None) -> str:
    """Cómo se llama esta instancia en pantalla."""
    if stage == "liga":
        return "Liga"
    if stage == "zona":
        return f"Zona {zone}" if zone else "Fase de zonas"
    return KNOCKOUT_ROUND_LABELS.get(stage, stage.replace("_", " ").capitalize())


def repartir_en_zonas(teams: list, zones_count: int) -> list:
    """
    Reparte los equipos en zonas en serpentina, respetando el orden recibido.

    Serpentina y no bloques: si los equipos vienen ordenados por qué tan fuertes
    son, cortarlos en bloques mete a los mejores en la misma zona y el torneo se
    define en la fase de grupos. Con serpentina (A B C / C B A / A B C…) cada
    zona se lleva uno de cada franja.

    Devuelve la misma lista con la clave `zone` seteada en cada equipo.
    """
    zones_count = max(1, min(int(zones_count or 1), MAX_ZONES, len(teams) or 1))

    for indice, team in enumerate(teams):
        vuelta, posicion = divmod(indice, zones_count)
        if vuelta % 2 == 1:
            posicion = zones_count - 1 - posicion
        team["zone"] = ZONE_NAMES[posicion]

    return teams


def round_robin(team_ids: list) -> list:
    """
    Todos contra todos, una rueda, por el método del círculo.

    Devuelve una lista de fechas; cada fecha es una lista de pares
    (local, visitante). Con cantidad impar de equipos se agrega un comodín
    (None) y al que le toca queda libre esa fecha: ese cruce no se emite, así
    que una fecha puede tener un partido menos que las otras.

    La localía se invierte en las fechas impares. Sin eso, el equipo que el
    método deja fijo juega TODAS las fechas de local, que es el defecto clásico
    de implementar el círculo sin mirar este detalle.
    """
    equipos = list(team_ids)
    if len(equipos) < 2:
        return []

    if len(equipos) % 2 == 1:
        equipos.append(None)

    total = len(equipos)
    fechas = []

    # El primero queda fijo y el resto rota: con n equipos salen n-1 fechas y
    # nadie repite rival.
    rotantes = equipos[1:]
    for numero_fecha in range(total - 1):
        vuelta = [equipos[0]] + rotantes
        partidos = []
        for i in range(total // 2):
            local, visitante = vuelta[i], vuelta[total - 1 - i]
            if local is None or visitante is None:
                continue  # el que queda libre esta fecha
            if numero_fecha % 2 == 1:
                local, visitante = visitante, local
            partidos.append((local, visitante))
        fechas.append(partidos)
        rotantes = [rotantes[-1]] + rotantes[:-1]

    return fechas


def fixture_de_liga(teams: list) -> list:
    """Fixture de una liga: todos contra todos en una sola tabla."""
    fechas = round_robin([t["id"] for t in teams])
    return [
        {
            "stage": "liga",
            "zone": None,
            "round": numero + 1,
            "order": orden,
            "home_team_id": local,
            "away_team_id": visitante,
        }
        for numero, partidos in enumerate(fechas)
        for orden, (local, visitante) in enumerate(partidos)
    ]


def fixture_de_zonas(teams: list) -> list:
    """Fase de grupos: un todos contra todos adentro de cada zona."""
    fixtures = []
    for zona in ZONE_NAMES:
        de_la_zona = [t for t in teams if t.get("zone") == zona]
        if len(de_la_zona) < 2:
            continue
        for numero, partidos in enumerate(round_robin([t["id"] for t in de_la_zona])):
            for orden, (local, visitante) in enumerate(partidos):
                fixtures.append({
                    "stage": "zona",
                    "zone": zona,
                    "round": numero + 1,
                    "order": orden,
                    "home_team_id": local,
                    "away_team_id": visitante,
                })
    return fixtures


def _ronda_para(cantidad: int) -> str:
    """Nombre de la ronda a la que entran `cantidad` equipos."""
    return KNOCKOUT_ROUND_NAMES.get(cantidad, f"ronda_de_{cantidad}")


def fixture_de_eliminacion(team_ids: list, ronda_inicial: int = 1) -> list:
    """
    Llaves de eliminación directa sobre una lista YA ordenada por siembra.

    Si la cantidad no es potencia de dos, los mejores sembrados pasan de largo:
    con 6 equipos, los dos primeros esperan en semis y los otros cuatro juegan
    cuartos. Es la forma estándar y evita inventar partidos contra nadie.

    Los cruces de la ronda inicial son 1 vs último, 2 vs anteúltimo, etc., para
    que los sembrados fuertes no se crucen entre ellos de entrada.

    Las rondas siguientes se crean VACÍAS y se van llenando a medida que se
    cargan resultados. Para saber a dónde va cada ganador, cada llave guarda
    `next_index` (índice dentro de la lista que devuelve esta función) y
    `next_slot` ("home"/"away"). Quien persiste traduce esos índices a ids.
    """
    equipos = [t for t in team_ids if t]
    if len(equipos) < 2:
        return []

    # Potencia de dos inmediatamente superior o igual.
    tamanio = 1
    while tamanio < len(equipos):
        tamanio *= 2

    libres = tamanio - len(equipos)  # cuántos pasan de largo la ronda inicial
    esperan = equipos[:libres]
    juegan = equipos[libres:]

    fixtures = []
    ronda = ronda_inicial

    cruces_iniciales = [
        (juegan[i], juegan[len(juegan) - 1 - i]) for i in range(len(juegan) // 2)
    ]

    indices_ronda = []  # índice en `fixtures` de cada llave de la ronda actual
    if cruces_iniciales:
        nombre = _ronda_para(tamanio)
        for orden, (local, visitante) in enumerate(cruces_iniciales):
            indices_ronda.append(len(fixtures))
            fixtures.append({
                "stage": nombre,
                "zone": None,
                "round": ronda,
                "order": orden,
                "home_team_id": local,
                "away_team_id": visitante,
                "next_index": None,
                "next_slot": None,
            })
        ronda += 1

    # `pendientes` describe quién ocupa cada butaca de la ronda siguiente: o un
    # equipo que pasó de largo, o el ganador de una llave ya creada.
    #
    # Se INTERCALAN, y no van los que esperan primero y los ganadores después:
    # como después se emparejan de a dos consecutivos, ponerlos en bloque hacía
    # que los que pasaron de largo se cruzaran ENTRE ELLOS y los ganadores
    # también. Con 6 equipos eso daba una semi t0 vs t1 — justo lo que el bye
    # tiene que evitar. Intercalados, cada uno que esperó enfrenta a un ganador.
    #
    # Los ganadores se toman de atrás para adelante cuando hay byes: el mejor
    # sembrado que esperó recibe al ganador del cruce de los peores sembrados.
    esperando = list(esperan)
    ganadores = list(reversed(indices_ronda)) if esperando else list(indices_ronda)

    pendientes = []
    while esperando or ganadores:
        if esperando:
            pendientes.append(("equipo", esperando.pop(0)))
        if ganadores:
            pendientes.append(("ganador", ganadores.pop(0)))

    while len(pendientes) > 1:
        nombre = _ronda_para(len(pendientes))
        siguientes = []
        for posicion in range(0, len(pendientes), 2):
            uno, dos = pendientes[posicion], pendientes[posicion + 1]
            indice = len(fixtures)
            fixtures.append({
                "stage": nombre,
                "zone": None,
                "round": ronda,
                "order": posicion // 2,
                "home_team_id": uno[1] if uno[0] == "equipo" else None,
                "away_team_id": dos[1] if dos[0] == "equipo" else None,
                "next_index": None,
                "next_slot": None,
            })
            if uno[0] == "ganador":
                fixtures[uno[1]]["next_index"] = indice
                fixtures[uno[1]]["next_slot"] = "home"
            if dos[0] == "ganador":
                fixtures[dos[1]]["next_index"] = indice
                fixtures[dos[1]]["next_slot"] = "away"
            siguientes.append(("ganador", indice))
        pendientes = siguientes
        ronda += 1

    return fixtures


def tabla_de_posiciones(teams: list, fixtures: list) -> list:
    """
    Tabla a partir de los partidos jugados. 3 por ganado, 1 por empatado.

    Sólo cuentan los fixtures de liga o de zona con status "jugado": las llaves
    de eliminación no suman a ninguna tabla.

    Desempate: puntos, diferencia de gol, goles a favor y al final el nombre,
    para que el orden sea estable y no baile entre dos lecturas iguales.
    """
    filas = {
        t["id"]: {
            "team_id": t["id"],
            "name": t.get("name", ""),
            "zone": t.get("zone"),
            "played": 0, "won": 0, "drawn": 0, "lost": 0,
            "goals_for": 0, "goals_against": 0, "goal_diff": 0, "points": 0,
        }
        for t in teams
    }

    for fx in fixtures:
        if fx.get("stage") not in ("liga", "zona") or fx.get("status") != "jugado":
            continue
        local, visitante = fx.get("home_team_id"), fx.get("away_team_id")
        if local not in filas or visitante not in filas:
            continue

        goles_local = int(fx.get("home_score") or 0)
        goles_visitante = int(fx.get("away_score") or 0)

        for equipo, hechos, recibidos in (
            (local, goles_local, goles_visitante),
            (visitante, goles_visitante, goles_local),
        ):
            fila = filas[equipo]
            fila["played"] += 1
            fila["goals_for"] += hechos
            fila["goals_against"] += recibidos
            if hechos > recibidos:
                fila["won"] += 1
                fila["points"] += POINTS_WIN
            elif hechos == recibidos:
                fila["drawn"] += 1
                fila["points"] += POINTS_DRAW
            else:
                fila["lost"] += 1
                fila["points"] += POINTS_LOSS

    for fila in filas.values():
        fila["goal_diff"] = fila["goals_for"] - fila["goals_against"]

    return sorted(
        filas.values(),
        key=lambda f: (-f["points"], -f["goal_diff"], -f["goals_for"], f["name"]),
    )


def clasificados(teams: list, fixtures: list, qualifiers_per_zone: int) -> list:
    """
    Los ids que pasan a la eliminatoria, ya ordenados por siembra.

    La siembra intercala zonas: primero los ganadores de cada zona, después los
    segundos, y así. Eso es lo que hace que el primero de la A no se cruce con
    el primero de la B en la ronda inicial.
    """
    tabla = tabla_de_posiciones(teams, fixtures)
    por_zona = {}
    for fila in tabla:
        por_zona.setdefault(fila["zone"], []).append(fila)

    sembrados = []
    for puesto in range(max(1, int(qualifiers_per_zone or 1))):
        for zona in ZONE_NAMES:
            filas = por_zona.get(zona, [])
            if puesto < len(filas):
                sembrados.append(filas[puesto]["team_id"])
    return sembrados


def ganador_de(fixture: dict) -> str | None:
    """
    Quién ganó una llave. None si está pendiente o si quedó sin definir.

    El empate en los noventa minutos NO define, pero ahora se puede cargar la
    tanda de penales aparte y esa sí define. Antes la única salida era volver a
    cargar el resultado con los penales ya sumados a los goles, o sea mentirle al
    marcador: un 2-2 que se ganó 4-3 quedaba escrito como 6-5, y ese numero
    despues aparecia en la tabla y en el historial del jugador.

    El marcador de los noventa sigue siendo el que cuenta para todo lo demás
    (tabla de posiciones, diferencia de gol, racha del jugador). Los penales sólo
    dicen quién pasa de ronda.
    """
    if fixture.get("status") != "jugado":
        return None

    local = fixture.get("home_score")
    visitante = fixture.get("away_score")
    if local is None or visitante is None:
        return None

    if local != visitante:
        return fixture["home_team_id"] if local > visitante else fixture["away_team_id"]

    pen_local = fixture.get("home_penalties")
    pen_visitante = fixture.get("away_penalties")
    if pen_local is None or pen_visitante is None or pen_local == pen_visitante:
        return None
    return fixture["home_team_id"] if pen_local > pen_visitante else fixture["away_team_id"]
