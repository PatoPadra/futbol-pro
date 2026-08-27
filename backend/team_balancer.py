from database import db
from constants import DEFAULT_LINEUP_ROLE, POSITION_MAP, capacidades_de, formaciones_de
from rating_calculator import get_player_scores_for_balance
import logging

logger = logging.getLogger(__name__)


# Quien no declaró género y quien eligió "prefiero no decir" caen en la MISMA
# bolsa a los efectos del reparto. No es una fusión conceptual de los dos casos:
# es que en los dos el balanceador no tiene un dato con el que separar, y meterlos
# en bolsas distintas sólo agregaría dos grupos chicos que se reparten peor.
GENDER_UNKNOWN = "sin_declarar"

# Orden de procesamiento de las bolsas. El orden importa: la primera bolsa se
# reparte sobre equipos vacíos y es la que más margen tiene para emparejar los
# puntajes, así que arranca la más grande (ver _bolsas_por_genero).
GENDER_BALANCE_BUCKETS = ["masculino", "femenino", "otro", GENDER_UNKNOWN]


def _bolsa_de_genero(player: dict) -> str:
    """Bolsa de reparto de un jugador. Ver GENDER_UNKNOWN."""
    genero = player.get("gender")
    if genero in ("masculino", "femenino", "otro"):
        return genero
    return GENDER_UNKNOWN


def _bolsas_por_genero(players: list) -> list:
    """
    Agrupa por género y devuelve las bolsas ordenadas de mayor a menor, cada una
    con sus jugadores de mejor a peor puntaje.

    Repartir bolsa por bolsa (y no la lista entera de una) es lo que garantiza
    que cada género quede dividido en partes iguales: dentro de una bolsa los
    jugadores se van alternando entre los dos equipos, así que al terminarla la
    diferencia de esa bolsa entre A y B es 0 o 1. Si la lista se recorriera
    entera ordenada por puntaje, un partido mixto podía terminar con todas las
    mujeres del mismo lado sin que el balance de puntaje se quejara.
    """
    por_bolsa = {}
    for p in players:
        por_bolsa.setdefault(_bolsa_de_genero(p), []).append(p)

    bolsas = [
        sorted(por_bolsa[nombre], key=lambda p: p["score"], reverse=True)
        for nombre in GENDER_BALANCE_BUCKETS
        if por_bolsa.get(nombre)
    ]
    # -len primero, y el índice de GENDER_BALANCE_BUCKETS como desempate para que
    # dos bolsas del mismo tamaño salgan siempre en el mismo orden (determinismo:
    # regenerar los equipos sin que cambie nada no debería dar otro resultado).
    bolsas.sort(key=lambda b: (-len(b), GENDER_BALANCE_BUCKETS.index(_bolsa_de_genero(b[0]))))
    return bolsas


# Peso del desbalance de género dentro del costo de orientar un par en el
# 11v11. Ver el comentario largo en _try_formation.
GENDER_PENALTY = 2.0

# Cuánta diferencia de PROMEDIO entre los dos equipos se considera "esto está
# completamente desparejo". Tres puntos en una escala de 0 a 10 es una barbaridad
# en la cancha: un equipo que promedia 7.5 contra uno que promedia 4.5 no es un
# partido.
BRECHA_MAXIMA = 3.0

# Por debajo de esta diferencia entre el mejor y el peor jugador del plantel, el
# balanceador no está balanceando nada: está repartiendo gente de la que no sabe
# nada. Pasa siempre en un grupo nuevo, donde el prior neutro y el piso de
# confianza aplastan a todos contra 5.9.
SPREAD_MINIMO_CONFIABLE = 0.5


def _balance_de(sum_a: float, count_a: int, sum_b: float, count_b: int) -> float:
    """Qué tan parejos quedaron los equipos, de 0 a 1.

    Mide la brecha de PROMEDIOS y no la de sumas. La fórmula vieja
    (`1 - |sumA - sumB| / total`) estaba diluida por el tamaño del equipo: en un
    11v11, un punto de diferencia POR JUGADOR daba 0.909 y la pantalla decía
    "muy parejo", mientras que en un 5v5 dos puntos por jugador daba 0.80 y
    decía "aceptable". El mismo desbalance real leído de dos formas distintas
    según cuánta gente hubiera.

    Con promedios, un punto de diferencia por jugador da 0.667 en cualquier
    modalidad — que es la verdad, y es la que hace que valga la pena rearmar.
    """
    if not count_a or not count_b:
        return 1.0
    brecha = abs(sum_a / count_a - sum_b / count_b)
    return max(0.0, 1.0 - brecha / BRECHA_MAXIMA)


def _spread_de(players: list) -> float:
    """Diferencia entre el mejor y el peor puntaje del plantel.

    Viaja con la generación para que la pantalla pueda decir la verdad cuando no
    hay con qué balancear. Un 97% de balance sobre un plantel donde todos valen
    lo mismo no es un buen reparto: es una cuenta hecha sobre nada.
    """
    puntajes = [p["score"] for p in players if p.get("score") is not None]
    if len(puntajes) < 2:
        return 0.0
    return round(max(puntajes) - min(puntajes), 2)


def _desbalance_genero_tras(gender_count: dict, en_a: dict, en_b: dict) -> int:
    """
    Desbalance total de géneros si `en_a` fuera al equipo A y `en_b` al B.

    Es la suma, sobre cada bolsa, de |cuántos hay en A - cuántos hay en B|.
    Cero significa que cada género quedó partido exactamente al medio.
    """
    proyectado = {bolsa: dict(c) for bolsa, c in gender_count.items()}
    proyectado.setdefault(_bolsa_de_genero(en_a), {"A": 0, "B": 0})
    proyectado[_bolsa_de_genero(en_a)]["A"] += 1
    proyectado.setdefault(_bolsa_de_genero(en_b), {"A": 0, "B": 0})
    proyectado[_bolsa_de_genero(en_b)]["B"] += 1
    return sum(abs(c["A"] - c["B"]) for c in proyectado.values())


def _position_fit(player: dict, target_pos: str) -> float:
    """Score how well a player fits a position."""
    primary = player.get("primary_position")
    secondary = player.get("secondary_positions", []) or []
    unwanted = player.get("unwanted_position")
    
    if target_pos == primary:
        return 1.0
    if target_pos in secondary:
        return 0.7
    if target_pos == unwanted:
        return 0.05
    
    # Same zone bonus
    target_zone = POSITION_MAP.get(target_pos, {}).get("zone", "")
    primary_zone = POSITION_MAP.get(primary, {}).get("zone", "") if primary else ""
    if target_zone and target_zone == primary_zone:
        return 0.4
    return 0.2


async def generate_teams(match_id: str) -> dict:
    """Generate balanced teams for a match."""
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise ValueError("Partido no encontrado")

    modality = match["modality"]
    max_per_team = modality

    # Get titular registrations
    registrations = await db.match_registrations.find(
        {"match_id": match_id, "status": "titular"},
        {"_id": 0}
    ).sort("order", 1).to_list(100)

    if len(registrations) < 2:
        raise ValueError("Se necesitan al menos 2 jugadores para generar equipos")

    # Perfiles y scores en batch. Antes esto era un for con dos awaits adentro:
    # un find_one del perfil + get_player_score_for_balance (que a su vez hace 4
    # queries). Para un 11v11 daba ~130 round-trips seriales. Ahora son 1 query
    # de perfiles + las métricas resueltas en paralelo con asyncio.gather.
    player_ids = [reg["player_id"] for reg in registrations]

    profiles = await db.player_profiles.find(
        {"id": {"$in": player_ids}}, {"_id": 0}
    ).to_list(len(player_ids) or 1)
    profile_by_id = {p["id"]: p for p in profiles}

    # Sólo pedimos score de los que tienen perfil: los otros se descartan igual.
    scores_by_id = await get_player_scores_for_balance(
        [pid for pid in player_ids if pid in profile_by_id]
    )

    # Recorremos registrations y no profiles para conservar el orden de anotación
    # (el sort("order", 1) de arriba), que es el que define el snake draft.
    players = []
    for reg in registrations:
        profile = profile_by_id.get(reg["player_id"])
        if not profile:
            continue
        score = scores_by_id[reg["player_id"]]
        players.append({
            "id": profile["id"],
            "name": profile["name"],
            "photo_url": profile.get("photo_url"),
            "primary_position": profile.get("primary_position"),
            "secondary_positions": profile.get("secondary_positions", []),
            "unwanted_position": profile.get("unwanted_position"),
            "gender": profile.get("gender"),
            "score": score,
            "player_score": round(float(score), 2),
        })

    formaciones = formaciones_de(modality)

    # El modo Entrenador no reparte a nadie: hay UN equipo, el nuestro, y el
    # rival no está en la app. Lo que se arma es una alineación con su banco, y
    # de ahí en más la toca el DT. El balanceador no tiene nada que hacer acá.
    if capacidades_de(match.get("mode")).get("team_source") == "manual":
        return _alineacion_de_dt(players, match_id, formaciones)

    # Con el plantel completo se arma por FORMACIÓN, en cualquier modalidad.
    # Antes esto era `if modality == 11`, y por eso un F5 o un F7 nunca veían la
    # cancha: caían siempre en el reparto sin puestos. Lo que decide no es el
    # número mágico 11 sino si hay gente para llenar los dos equipos.
    if formaciones and len(players) >= modality * 2:
        return _balance_con_formacion(players[:modality * 2], match_id, formaciones)

    # Si falta gente, no hay formación que se pueda completar: se reparte igual,
    # sin puestos, para que el organizador tenga los equipos aunque falten dos.
    return _balance_small_format(players, match_id, modality)


def _balance_small_format(players: list, match_id: str, modality: int) -> dict:
    """
    Reparte de 5v5 a 10v10 alternando por puntaje, bolsa de género por bolsa.

    Antes era un snake draft sobre la lista entera ordenada por puntaje. Eso
    equilibra los puntajes pero es ciego al género: en un mixto con 4 mujeres,
    si las cuatro caían en posiciones del ciclo que van al mismo equipo, iban
    todas al mismo equipo y el balance de puntaje quedaba igual de contento.

    Ahora se recorre bolsa por bolsa (masculino, femenino, otro, sin declarar) y
    dentro de cada una se toman los jugadores DE A PARES: el de más puntaje del
    par va al equipo que viene más flojo. Como cada par aporta uno a cada lado,
    al terminar la bolsa cada género quedó partido al medio. Y como el par se
    orienta mirando la suma acumulada, el puntaje se sigue emparejando —
    quedan las dos cosas, no una a costa de la otra.

    El jugador impar de una bolsa va al equipo con menos gente (desempata la
    suma más baja), y no siempre al mismo: así varias bolsas impares no se
    apilan todas del mismo lado.
    """
    team_a = []
    team_b = []
    sum_a = 0.0
    sum_b = 0.0

    for bolsa in _bolsas_por_genero(players):
        for i in range(0, len(bolsa), 2):
            par = bolsa[i:i + 2]

            if len(par) == 1:
                solo = par[0]
                if (len(team_a), sum_a) <= (len(team_b), sum_b):
                    team_a.append(solo)
                    sum_a += solo["score"]
                else:
                    team_b.append(solo)
                    sum_b += solo["score"]
                continue

            mejor, peor = par
            if sum_a <= sum_b:
                team_a.append(mejor)
                team_b.append(peor)
                sum_a += mejor["score"]
                sum_b += peor["score"]
            else:
                team_b.append(mejor)
                team_a.append(peor)
                sum_b += mejor["score"]
                sum_a += peor["score"]

    # Cada equipo con su arquero. Va acá y no antes de repartir para no romper
    # el balance de género que el reparto por bolsas acaba de conseguir.
    _equilibrar_arqueros(team_a, team_b)

    arqueros = {
        equipo: _puesto_de_arquero(plantel)
        for equipo, plantel in (("A", team_a), ("B", team_b))
    }

    assignments = [
        _assignment(
            p,
            equipo,
            "GK" if p["id"] == arqueros[equipo] else (p.get("primary_position") or "JUG"),
        )
        for equipo, plantel in (("A", team_a), ("B", team_b))
        for p in plantel
    ]

    # Las sumas se recalculan de las listas finales: `_equilibrar_arqueros` puede
    # haber intercambiado dos jugadores, y las que se venían acumulando en el
    # bucle quedarían desactualizadas.
    sum_a = sum(p["score"] for p in team_a)
    sum_b = sum(p["score"] for p in team_b)
    balance_score = _balance_de(sum_a, len(team_a), sum_b, len(team_b))

    return {
        "match_id": match_id,
        "formation_a": None,
        "formation_b": None,
        "assignments": assignments,
        "balance_score": round(balance_score, 4),
        "score_spread": _spread_de(players),
        "gender_split": _gender_split(team_a, team_b),
    }


# Con cuánta gente por lado tiene sentido nombrar un arquero. Por debajo de esto
# ya no es un partido con arco, es un picadito.
MINIMO_PARA_ARQUERO = 3


def _es_arquero(player: dict) -> bool:
    return player.get("primary_position") == "GK"


def _quiere_atajar(player: dict) -> bool:
    """Nadie que haya marcado el arco como puesto no deseado va al arco."""
    return player.get("unwanted_position") != "GK"


def _equilibrar_arqueros(team_a: list, team_b: list) -> None:
    """Si los arqueros naturales quedaron todos de un lado, pasa uno al otro.

    Muta las listas. Se llama DESPUÉS de repartir y no antes a propósito: el
    reparto por bolsas de género es lo que garantiza que cada género quede
    partido al medio, y reservar dos arqueros antes lo rompería. Acá se toca lo
    mínimo, y el intercambio se elige para no deshacer lo ya logrado — mismo
    género primero, y de esos el de puntaje más parecido.

    Sin esto, en un plantel con un solo arquero (que es lo normal) el otro
    equipo jugaba con el arco vacío, y con dos podían caer los dos del mismo
    lado sin que nada se quejara.
    """
    if len(team_a) < MINIMO_PARA_ARQUERO or len(team_b) < MINIMO_PARA_ARQUERO:
        return

    arqueros_a = [p for p in team_a if _es_arquero(p)]
    arqueros_b = [p for p in team_b if _es_arquero(p)]

    if (arqueros_a and arqueros_b) or (not arqueros_a and not arqueros_b):
        # O están bien repartidos, o no hay ninguno y los dos equipos van a
        # tener que designar a alguien. En ninguno de los dos casos hay nada
        # que mover.
        return

    if len(arqueros_a) + len(arqueros_b) < 2:
        # Hay un solo arquero natural en todo el plantel: no alcanza para los
        # dos arcos, así que moverlo sólo cambiaría de lado el problema.
        return

    origen, destino = (team_a, team_b) if arqueros_a else (team_b, team_a)
    arqueros = arqueros_a or arqueros_b
    # Se va el peor de los arqueros de sobra: el mejor se queda atajando donde ya está.
    sale = min(arqueros, key=lambda p: p["score"])

    candidatos = [p for p in destino if not _es_arquero(p)] or list(destino)
    misma_bolsa = [p for p in candidatos if _bolsa_de_genero(p) == _bolsa_de_genero(sale)]
    entra = min(misma_bolsa or candidatos, key=lambda p: abs(p["score"] - sale["score"]))

    origen.remove(sale)
    destino.remove(entra)
    origen.append(entra)
    destino.append(sale)


def _puesto_de_arquero(plantel: list) -> str | None:
    """Quién ataja en este equipo. Devuelve el player_id, o None si no hay arco.

    Si hay arqueros naturales, ataja el mejor: es un puesto de especialista y
    no tiene sentido mandar al arco al peor de dos que saben.

    Si no hay ninguno, ataja el de MENOR puntaje entre los que no lo rechazaron.
    Es el mismo criterio que en las formaciones: los mejores se quedan en la
    cancha, y el arco lo cubre quien menos pierde el equipo estando ahí.
    """
    if len(plantel) < MINIMO_PARA_ARQUERO:
        return None

    naturales = [p for p in plantel if _es_arquero(p)]
    if naturales:
        return max(naturales, key=lambda p: p["score"])["id"]

    dispuestos = [p for p in plantel if _quiere_atajar(p)]
    # Si TODOS marcaron el arco como no deseado, alguien tiene que ir igual:
    # un equipo sin arquero no es una opción.
    return min(dispuestos or plantel, key=lambda p: p["score"])["id"]


def _assignment(player: dict, team: str, position: str, role: str = DEFAULT_LINEUP_ROLE) -> dict:
    """La fila de un jugador en la generación. Un solo lugar donde se arma.

    `role` sólo lo mueven los modos con banco. En los demás son todos titulares,
    que es el default, y nadie tiene que pensar en el campo.
    """
    return {
        "player_id": player["id"],
        "player_name": player["name"],
        "player_photo": player.get("photo_url"),
        "player_gender": player.get("gender"),
        "team": team,
        "position": position,
        "role": role,
        "is_manual": False,
        "player_score": player.get("player_score"),
    }


def _gender_split(team_a: list, team_b: list) -> dict:
    """
    Cuántos de cada bolsa quedaron en cada equipo. Se guarda con la generación
    para que la pantalla de equipos pueda mostrar el reparto y para poder
    auditar el balanceo sin volver a correrlo.
    """
    conteo = {}
    for equipo, plantel in (("A", team_a), ("B", team_b)):
        for p in plantel:
            bolsa = _bolsa_de_genero(p)
            conteo.setdefault(bolsa, {"A": 0, "B": 0})[equipo] += 1
    return conteo


def _once_de(players: list, puestos: list) -> tuple:
    """Llena una formación con los mejores disponibles. Devuelve (once, fit_promedio).

    Mismo criterio que usa el balanceador para el 11v11: primero quién encaja en
    el puesto y después quién es mejor. Un arquero natural le gana a un crack que
    nunca atajó, que es lo que uno quiere de un punto de partida.

    Y eso es: un punto de partida. La gracia del modo es que el DT lo corrija, no
    que el algoritmo tenga razón.
    """
    usados = set()
    once = []
    fit_total = 0.0

    for pos in puestos:
        candidatos = [
            (jugador, _position_fit(jugador, pos))
            for jugador in players
            if jugador["id"] not in usados
        ]
        if not candidatos:
            break
        candidatos.sort(key=lambda par: (par[1], par[0]["score"]), reverse=True)
        elegido, fit = candidatos[0]
        once.append((pos, elegido))
        usados.add(elegido["id"])
        fit_total += fit

    return once, (fit_total / len(puestos) if puestos else 0.0)


def _alineacion_de_dt(players: list, match_id: str, formaciones: dict) -> dict:
    """Un equipo con su banco: los que arrancan y los que esperan.

    Se prueban todas las formaciones de la modalidad y gana la que mejor le
    calza al plantel que hay. Con quince jugadores para once puestos, los cuatro
    que sobran van al banco con su puesto natural.

    Ojo con la palabra "suplente": acá significa "está en el banco de MI equipo y
    puede entrar", que no es lo mismo que el `status: suplente` de la
    inscripción, donde significa "no entró en el cupo del partido". Por eso el
    banco vive en la alineación y no en las inscripciones.
    """
    if not formaciones:
        # Sin formaciones para la modalidad no hay once que llenar: van todos
        # como titulares en su puesto y que el DT ordene.
        asignaciones = [
            _assignment(jugador, "A", jugador.get("primary_position") or "JUG")
            for jugador in players
        ]
        return {
            "match_id": match_id,
            "formation_a": None,
            "formation_b": None,
            "assignments": asignaciones,
            "balance_score": 1.0,
            "score_spread": _spread_de(players),
            "gender_split": _gender_split(players, []),
        }

    mejor_nombre = None
    mejor_once = []
    mejor_fit = -1.0
    for nombre, puestos in formaciones.items():
        once, fit = _once_de(players, puestos)
        if fit > mejor_fit:
            mejor_nombre, mejor_once, mejor_fit = nombre, once, fit

    titulares = {jugador["id"] for _, jugador in mejor_once}
    asignaciones = [
        _assignment(jugador, "A", pos, role="titular") for pos, jugador in mejor_once
    ]
    asignaciones += [
        _assignment(jugador, "A", jugador.get("primary_position") or "JUG", role="suplente")
        for jugador in players
        if jugador["id"] not in titulares
    ]

    return {
        "match_id": match_id,
        "formation_a": mejor_nombre,
        # No hay equipo B: el rival no está en la app.
        "formation_b": None,
        "assignments": asignaciones,
        # No significa nada con un solo equipo — no hay dos lados que emparejar.
        # Se manda 1.0 porque el modelo pide un número, y la pantalla lo esconde
        # en este modo en vez de mostrar un "Balance: 100%" que no quiere decir
        # nada.
        "balance_score": 1.0,
        "gender_split": _gender_split([jugador for _, jugador in mejor_once], []),
    }


def _balance_con_formacion(players: list, match_id: str, formaciones: dict) -> dict:
    """
    Arma los dos equipos probando todas las formaciones de la modalidad y se
    queda con la que mejor combina balance de puntaje y jugadores en su puesto.
    """
    best_result = None
    best_score = -1

    for formation_name, positions in formaciones.items():
        result = _try_formation(players, positions, formation_name, match_id)
        if result and result["combined_score"] > best_score:
            best_score = result["combined_score"]
            best_result = result

    if not best_result:
        return _balance_small_format(players, match_id, len(players) // 2)

    return {
        "match_id": match_id,
        "formation_a": best_result["formation"],
        "formation_b": best_result["formation"],
        "assignments": best_result["assignments"],
        "balance_score": round(best_result["balance_score"], 4),
        "score_spread": _spread_de(players),
        "gender_split": best_result["gender_split"],
    }


def _try_formation(players: list, formation_positions: list, formation_name: str, match_id: str) -> dict:
    """Try a specific formation and return the best assignment."""
    # We need 22 players for 2 teams of 11
    # Each position in the formation needs 2 players (one per team)
    
    available = list(players)
    position_pairs = []  # List of (position, player_a, player_b)
    
    total_fit_score = 0
    assigned_ids = set()

    for pos in formation_positions:
        # Find best 2 available players for this position
        candidates = []
        for p in available:
            if p["id"] not in assigned_ids:
                fit = _position_fit(p, pos)
                candidates.append((p, fit))
        
        # Al arco va el que MENOS juega, no el que más.
        #
        # El fit sigue mandando: un arquero de verdad (1.0) le gana a cualquiera.
        # Lo que cambia es el desempate ENTRE IGUALES. Antes, con un solo arquero
        # natural, el segundo arco se lo llevaba el defensor de más puntaje del
        # grupo — porque todos los defensores comparten fit 0.4 por zona y el
        # desempate era por puntaje descendente. Sin ningún arquero, iban los dos
        # mejores centrales.
        #
        # Es la escena que rompe el partido del sábado: nadie quiere atajar, y el
        # sistema le encajaba el arco justo al que mejor juega. Al revés, los
        # mejores quedan en la cancha y el arco lo cubre quien menos pierde el
        # equipo estando ahí.
        #
        # Quien marcó GK como puesto no deseado ya queda casi último por fit
        # (0.05), así que este cambio no lo arrastra.
        if pos == "GK":
            candidates.sort(key=lambda x: (-x[1], x[0]["score"]))
        else:
            candidates.sort(key=lambda x: (-x[1], -x[0]["score"]))
        
        if len(candidates) < 2:
            # Not enough players, try with what we have
            if len(candidates) == 1:
                p1 = candidates[0]
                position_pairs.append((pos, p1[0], None))
                total_fit_score += p1[1]
                assigned_ids.add(p1[0]["id"])
            continue
        
        p1, p2 = candidates[0], candidates[1]
        position_pairs.append((pos, p1[0], p2[0]))
        total_fit_score += p1[1] + p2[1]
        assigned_ids.add(p1[0]["id"])
        assigned_ids.add(p2[0]["id"])

    # Now split into teams trying to balance
    team_a_players = []
    team_b_players = []
    sum_a = 0
    sum_b = 0
    gender_count = {}

    # Definida una sola vez y no adentro del for: lee sum_a, sum_b y gender_count
    # por closure EN EL MOMENTO DE LLAMARLA, así que ve siempre los valores
    # actuales de la iteración en curso. Rearmarla en cada par no cambiaba nada y
    # eran ~77 funciones descartadas por cada generación de un 11v11.
    def costo(a_player, b_player):
        desbalance_puntaje = abs(
            (sum_a + a_player["score"]) - (sum_b + b_player["score"])
        )
        desbalance_genero = _desbalance_genero_tras(gender_count, a_player, b_player)
        return desbalance_puntaje + GENDER_PENALTY * desbalance_genero

    for pos, p1, p2 in position_pairs:
        if p2 is None:
            # Only one player for this position, assign to smaller team
            if sum_a <= sum_b:
                team_a_players.append((pos, p1))
                sum_a += p1["score"]
                gender_count.setdefault(_bolsa_de_genero(p1), {"A": 0, "B": 0})["A"] += 1
            else:
                team_b_players.append((pos, p1))
                sum_b += p1["score"]
                gender_count.setdefault(_bolsa_de_genero(p1), {"A": 0, "B": 0})["B"] += 1
            continue
        
        # Los dos jugadores de este puesto van uno a cada equipo; lo único que
        # se decide acá es de qué lado va cada uno. Antes se miraba sólo la suma
        # de puntaje (el mejor al equipo más flojo). Ahora se evalúan las dos
        # orientaciones y gana la de menor costo, donde el costo suma la
        # diferencia de puntaje MÁS una penalización por desbalance de género.
        #
        # No es un desempate: es un término del costo, con peso GENDER_PENALTY.
        # Con puntajes de 0 a 10, 2.0 pesa como un quinto de jugador — alcanza
        # para inclinar la orientación cuando el puntaje da parecido, y no para
        # armar un equipo notoriamente más fuerte con tal de repartir géneros.
        higher = p1 if p1["score"] >= p2["score"] else p2
        lower = p2 if p1["score"] >= p2["score"] else p1

        if costo(higher, lower) <= costo(lower, higher):
            en_a, en_b = higher, lower
        else:
            en_a, en_b = lower, higher

        team_a_players.append((pos, en_a))
        team_b_players.append((pos, en_b))
        sum_a += en_a["score"]
        sum_b += en_b["score"]
        gender_count.setdefault(_bolsa_de_genero(en_a), {"A": 0, "B": 0})["A"] += 1
        gender_count.setdefault(_bolsa_de_genero(en_b), {"A": 0, "B": 0})["B"] += 1

    assignments = [
        _assignment(p, equipo, pos)
        for equipo, plantel in (("A", team_a_players), ("B", team_b_players))
        for pos, p in plantel
    ]

    balance_score = _balance_de(sum_a, len(team_a_players), sum_b, len(team_b_players))
    avg_fit = total_fit_score / (len(formation_positions) * 2) if formation_positions else 0

    combined_score = balance_score * 0.6 + avg_fit * 0.4

    return {
        "formation": formation_name,
        "assignments": assignments,
        "balance_score": balance_score,
        "fit_score": avg_fit,
        "combined_score": combined_score,
        "gender_split": _gender_split(
            [p for _, p in team_a_players], [p for _, p in team_b_players]
        ),
    }
