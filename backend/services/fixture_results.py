"""
El resultado de una llave de torneo, y su bajada a los partidos enlazados.

Vive en un service y no en la ruta porque ahora tiene DOS puertas de entrada: se
puede cargar desde el torneo (la de siempre) o desde el partido de un grupo que
quedó enlazado a esa llave. Las dos terminan acá, y por eso hay un solo lugar
donde el marcador de un fixture se escribe.

Esa es la regla de oro del enganche entre torneos y partidos: **el fixture es el
dueño del resultado**. Los partidos enlazados reciben una copia orientada desde
su lado. Si cada partido tuviera el suyo, un fixture con los dos partidos
creados tendria dos escritores para el mismo numero y ninguna forma de saber
cual vale.

La cascada de las llaves (`propagar_ganador`) se movio para aca tal cual estaba.
Es la logica mas delicada del proyecto -- corregir unos octavos tiene que
desasentar al campeon, en cascada -- y la idea era justamente NO reescribirla.
"""

from datetime import datetime, timezone

from database import db
from services.tournament import ganador_de, tabla_de_posiciones

# Las llaves que se definen si o si: un empate no sirve, alguien tiene que pasar.
# En liga y en zonas el empate es un resultado valido y suma un punto a cada uno,
# asi que ahi los penales no existen.
ETAPAS_QUE_DEFINEN = ("dieciseisavos", "octavos", "cuartos", "semifinal", "final")


def admite_penales(fixture: dict) -> bool:
    return fixture.get("stage") in ETAPAS_QUE_DEFINEN


def validar_penales(fixture: dict, local: int, visitante: int, pen_local, pen_visitante) -> None:
    """Las reglas de los penales, en un solo lugar. Levanta ValueError.

    Son tres y las tres son de sentido comun, pero conviene que esten escritas:
    los penales solo existen donde hay que definir, solo cuando se empato, y no
    pueden terminar empatados ellos mismos.
    """
    hay_penales = pen_local is not None or pen_visitante is not None
    if not hay_penales:
        return

    if pen_local is None or pen_visitante is None:
        raise ValueError("Cargá los penales de los dos equipos")
    if not admite_penales(fixture):
        raise ValueError("En esta instancia el empate es un resultado válido: no van penales")
    if local != visitante:
        raise ValueError("Los penales sólo se cargan cuando el partido terminó empatado")
    if pen_local == pen_visitante:
        raise ValueError("Una tanda de penales no termina empatada")


async def _propagar_ganador(fixture_id: str | None, slot: str | None, equipo: str | None) -> None:
    """
    Sienta a `equipo` en una butaca de la llave siguiente, y limpia en cascada lo
    que haya quedado abajo si esa butaca cambia de ocupante.

    La cascada es el punto. Antes esto sólo escribía el next_fixture_id
    INMEDIATO, y con eso alcanza mientras nadie corrija nada. Pero si el torneo
    ya avanzó dos rondas y se corrige un resultado de octavos que cambia el
    ganador, el equipo viejo seguía figurando como ganador de cuartos, de semis
    y hasta como campeón: la llave siguiente ya estaba jugada y su propio avance
    ya estaba persistido. El torneo quedaba mintiendo sin que nada avisara.

    Ahora, si la butaca cambia de ocupante y esa llave ya estaba jugada, el
    resultado se borra (se jugó contra otro rival: ya no significa nada) y se
    sigue hacia abajo desasentando a quien había avanzado desde ahí. Termina
    solo porque las llaves apuntan siempre hacia adelante.

    `equipo=None` es válido y quiere decir "esta butaca vuelve a estar vacía":
    pasa cuando un resultado se corrige a empate, que en eliminación no define.
    """
    if not fixture_id:
        return

    siguiente = await db.tournament_fixtures.find_one({"id": fixture_id}, {"_id": 0})
    if not siguiente:
        return

    campo = "home_team_id" if slot == "home" else "away_team_id"
    if siguiente.get(campo) == equipo:
        return  # nada cambió: no hay por qué tocar lo que ya se jugó

    cambios = {campo: equipo}
    estaba_jugado = siguiente.get("status") == "jugado"
    if estaba_jugado:
        cambios.update({
            "home_score": None,
            "away_score": None,
            "home_penalties": None,
            "away_penalties": None,
            "status": "pendiente",
        })

    await db.tournament_fixtures.update_one({"id": fixture_id}, {"$set": cambios})

    # El resultado que se acaba de borrar tambien hay que sacarlo de los partidos
    # enlazados: se jugo contra otro rival, ya no significa nada.
    if estaba_jugado:
        await _borrar_resultado_de_partidos(fixture_id)
        await _propagar_ganador(
            siguiente.get("next_fixture_id"), siguiente.get("next_slot"), None
        )


async def _partidos_de(fixture_id: str) -> list:
    return await db.matches.find({"fixture_id": fixture_id}, {"_id": 0}).to_list(10)


async def _borrar_resultado_de_partidos(fixture_id: str) -> None:
    await db.matches.update_many(
        {"fixture_id": fixture_id}, {"$set": {"result": None}}
    )


def orientar(fixture: dict, lado: str) -> tuple:
    """El marcador visto desde uno de los dos lados. (a_favor, en_contra, pen_a_favor, pen_en_contra).

    Un fixture dice "3 a 1" desde el equipo local. Para el partido del grupo
    visitante ese mismo resultado es "1 a 3": en SU partido el local es el.
    Invertir esto al reves es la clase de error que despues nadie encuentra
    porque el numero igual se ve bien.
    """
    local = fixture.get("home_score")
    visitante = fixture.get("away_score")
    pen_local = fixture.get("home_penalties")
    pen_visitante = fixture.get("away_penalties")

    if lado == "away":
        return visitante, local, pen_visitante, pen_local
    return local, visitante, pen_local, pen_visitante


async def bajar_a_los_partidos(fixture: dict, actor: dict | None = None) -> int:
    """Copia el resultado del fixture a cada partido enlazado, ya orientado.

    Se conserva la nota del partido si tenia una: es contexto que escribio el
    organizador ("faltaron tres", "llovia") y no tiene por que perderse porque el
    marcador se corrigio.
    """
    partidos = await _partidos_de(fixture["id"])
    if not partidos:
        return 0

    ahora = datetime.now(timezone.utc).isoformat()
    for partido in partidos:
        a_favor, en_contra, pen_a_favor, pen_en_contra = orientar(
            fixture, partido.get("fixture_side") or "home"
        )
        if a_favor is None or en_contra is None:
            await db.matches.update_one({"id": partido["id"]}, {"$set": {"result": None}})
            continue

        anterior = partido.get("result") or {}
        await db.matches.update_one(
            {"id": partido["id"]},
            {"$set": {"result": {
                "home_score": a_favor,
                "away_score": en_contra,
                "home_penalties": pen_a_favor,
                "away_penalties": pen_en_contra,
                "notes": anterior.get("notes"),
                "loaded_by": (actor or {}).get("id") or anterior.get("loaded_by"),
                "loaded_by_name": (actor or {}).get("name") or anterior.get("loaded_by_name"),
                "loaded_at": ahora,
                # Marca que el numero no se cargo acá sino en el torneo. La
                # pantalla la usa para no ofrecer editarlo en dos lugares.
                "from_fixture": True,
            }}},
        )

    return len(partidos)


async def revisar_final(tournament_id: str) -> None:
    """
    Marca el torneo como finalizado cuando ya no queda nada por jugar.

    En liga y zonas eso es "todos los partidos jugados"; en llaves es "la final
    tiene ganador". El campeón se guarda en el torneo para no tener que
    recalcularlo cada vez que alguien abre la pantalla.
    """
    fixtures = await db.tournament_fixtures.find(
        {"tournament_id": tournament_id}, {"_id": 0}
    ).sort([("round", 1), ("order", 1)]).to_list(500)
    if not fixtures:
        return

    tournament = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if not tournament:
        return
    teams = await db.tournament_teams.find(
        {"tournament_id": tournament_id}, {"_id": 0}
    ).sort("seed", 1).to_list(200)

    # Todas las ramas escriben estado Y campeón, incluso para "volver atrás":
    # corregir el resultado de una final ya cargada tiene que DESfinalizar el
    # torneo, no dejarlo con un campeón viejo que ya no gana nada.
    final = next((fx for fx in fixtures if fx["stage"] == "final"), None)
    if final:
        campeon = ganador_de(final)
        await db.tournaments.update_one(
            {"id": tournament_id},
            {"$set": {
                "status": "finalizado" if campeon else "eliminatoria",
                "champion_team_id": campeon,
            }},
        )
        return

    if tournament["format"] == "liga":
        completo = all(fx["status"] == "jugado" for fx in fixtures)
        tabla = tabla_de_posiciones(teams, fixtures)
        campeon = tabla[0]["team_id"] if (completo and tabla) else None
        await db.tournaments.update_one(
            {"id": tournament_id},
            {"$set": {
                "status": "finalizado" if completo else "fase_grupos",
                "champion_team_id": campeon,
            }},
        )
    # En zonas_eliminatoria no se finaliza acá: terminar la fase de grupos sólo
    # habilita generar la eliminatoria (ver /playoffs).


async def aplicar_resultado(
    fixture: dict,
    *,
    home_score: int,
    away_score: int,
    home_penalties: int | None = None,
    away_penalties: int | None = None,
    actor: dict | None = None,
) -> dict:
    """Escribe el resultado de una llave, hace avanzar el cuadro y baja la copia.

    Es la unica funcion que escribe el marcador de un fixture. Las dos puertas
    de entrada (el torneo y el partido enlazado) terminan aca.

    Devuelve el fixture actualizado.
    """
    validar_penales(fixture, home_score, away_score, home_penalties, away_penalties)

    cambios = {
        "home_score": home_score,
        "away_score": away_score,
        "home_penalties": home_penalties,
        "away_penalties": away_penalties,
        "status": "jugado",
    }
    await db.tournament_fixtures.update_one({"id": fixture["id"]}, {"$set": cambios})

    actualizado = {**fixture, **cambios}

    await _propagar_ganador(
        fixture.get("next_fixture_id"), fixture.get("next_slot"), ganador_de(actualizado)
    )
    await revisar_final(fixture["tournament_id"])
    await bajar_a_los_partidos(actualizado, actor)

    return actualizado


async def desenlazar_partidos(fixture_ids: list) -> None:
    """Suelta los partidos de las llaves que dejan de existir.

    Los partidos NO se borran: son de los grupos, con sus inscriptos, su
    asistencia y sus evaluaciones adentro. Que un torneo se regenere o se borre
    no puede llevarse puesto eso.
    """
    if not fixture_ids:
        return
    await db.matches.update_many(
        {"fixture_id": {"$in": fixture_ids}},
        {"$unset": {"fixture_id": "", "fixture_side": "", "tournament_id": ""}},
    )
