"""
El resultado del partido, convertido en puntaje para cada jugador.

Por qué existe una colección aparte y no un `$inc` sobre el rating: todo el
cálculo de puntaje de este proyecto se deriva de la evidencia guardada y se
puede volver a calcular de cero. Un Elo incremental rompería eso — corregir un
resultado dejaría pegado un delta viejo que ya nadie sabe de dónde salió. Acá se
guarda EVIDENCIA (qué se esperaba, qué pasó, contra quién), no una conclusión, y
recalcular es idempotente: borra y vuelve a escribir.

La pieza que hace que esto no sea circular es `player_score` dentro de
`team_generations`: es cuánto valía cada jugador CUANDO SE ARMARON LOS EQUIPOS,
congelado. Así "qué se esperaba" se contesta con lo que creíamos en ese momento y
no con lo que creemos ahora, que ya está contaminado por el resultado.
"""

from datetime import datetime, timezone
import uuid

from constants import (
    capacidades_de,
    jugo_el_partido,
    probabilidad_esperada,
    puntaje_por_resultado,
    resultado_real,
)
from database import db
from rating_calculator import NEUTRAL_PRIOR

# En un partido interno el local es el equipo A y el visitante el B. Está escrito
# acá una sola vez para que el día que exista el rival externo se cambie en un
# lugar y no en cinco.
EQUIPO_LOCAL = "A"
EQUIPO_VISITANTE = "B"


def _cuando(match: dict) -> str:
    """La fecha que se usa para el peso por recencia: la del partido, no la de carga.

    Cargar en enero el resultado de un partido de octubre no lo convierte en un
    partido reciente.
    """
    fecha = match.get("date")
    if isinstance(fecha, str) and len(fecha) == 10:
        return f"{fecha}T00:00:00+00:00"
    return (match.get("result") or {}).get("loaded_at") or datetime.now(timezone.utc).isoformat()


def _fuerza(asignaciones: list) -> float:
    """Cuánto valía un equipo cuando se armó: el promedio de sus jugadores."""
    if not asignaciones:
        return NEUTRAL_PRIOR
    puntajes = []
    for asignacion in asignaciones:
        try:
            puntajes.append(float(asignacion.get("player_score")))
        except (TypeError, ValueError):
            # Una asignación sin puntaje congelado (partido viejo, ajuste manual)
            # vale el prior neutro. Descartarla torcería la fuerza del equipo
            # hacia arriba o hacia abajo según a quién le falte el dato.
            puntajes.append(NEUTRAL_PRIOR)
    return sum(puntajes) / len(puntajes)


async def _limpiar(match_id: str) -> dict:
    await db.match_outcomes.delete_many({"match_id": match_id})
    await db.matches.update_one(
        {"id": match_id}, {"$unset": {"result.expected_home": ""}}
    )
    return {"rows": 0, "expected_home": None}


async def recalcular_outcomes(match_id: str) -> dict:
    """Rehace las filas de resultado de un partido a partir de lo que hay guardado.

    Idempotente: borra las que había y escribe las que corresponden. Se la llama
    al cargar o corregir un resultado, y al retocar los equipos a mano de un
    partido que ya lo tiene.

    Devuelve un resumen para que quien la llame pueda contar qué pasó. Si el
    partido no reúne las condiciones (sin resultado, sin equipos, o en un modo
    que no usa puntajes) deja todo limpio y devuelve cero filas: eso también es
    un estado correcto, no un error.
    """
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        return {"rows": 0, "expected_home": None}

    resultado = match.get("result")
    if not resultado:
        return await _limpiar(match_id)

    capacidades = capacidades_de(match.get("mode"))

    # En los modos sin puntaje (Diversión) el resultado se muestra y nada más.
    # Que la app anote quién ganó no significa que le ponga nota a nadie.
    if not capacidades.get("usa_puntajes"):
        return await _limpiar(match_id)

    # Contra un rival que no está en la app no se puede calcular qué se esperaba:
    # no sabemos cuánto vale ese equipo. Se podría asumir que es promedio, pero
    # sería inventar la mitad de la cuenta — y encima con un sesgo conocido, que
    # el equipo que juega contra rivales flojos le infle el puntaje a todos.
    #
    # Así que el modo Entrenador NO usa este canal. Sigue teniendo evaluaciones
    # entre pares y estadísticas, que son medidas individuales y no dependen de
    # saber contra quién se jugó.
    if capacidades.get("opponent") == "externo":
        return await _limpiar(match_id)

    generacion = await db.team_generations.find_one({"match_id": match_id}, {"_id": 0})
    if not generacion:
        return await _limpiar(match_id)

    registraciones = await db.match_registrations.find(
        {"match_id": match_id, "status": {"$ne": "baja"}},
        {"_id": 0},
    ).to_list(500)
    # El que no vino no se lleva el resultado. Sin esto, el que plantó el sábado
    # cobraría igual la victoria que los que fueron.
    jugaron = {reg["player_id"] for reg in registraciones if jugo_el_partido(reg)}

    por_equipo = {EQUIPO_LOCAL: [], EQUIPO_VISITANTE: []}
    for asignacion in generacion.get("assignments", []):
        equipo = asignacion.get("team")
        if equipo in por_equipo and asignacion.get("player_id") in jugaron:
            por_equipo[equipo].append(asignacion)

    # Con un equipo vacío no hay comparación posible: no se puede decir contra
    # quién se ganó.
    if not por_equipo[EQUIPO_LOCAL] or not por_equipo[EQUIPO_VISITANTE]:
        return await _limpiar(match_id)

    goles = {
        EQUIPO_LOCAL: int(resultado.get("home_score") or 0),
        EQUIPO_VISITANTE: int(resultado.get("away_score") or 0),
    }
    fuerza = {equipo: _fuerza(jugadores) for equipo, jugadores in por_equipo.items()}
    cuando = _cuando(match)
    match_type = match.get("match_type") or "oficial"

    filas = []
    esperado_local = None
    for equipo, jugadores in por_equipo.items():
        rival = EQUIPO_VISITANTE if equipo == EQUIPO_LOCAL else EQUIPO_LOCAL
        # La expectativa es del EQUIPO, así que se calcula una vez y la comparten
        # sus once. Lo que el resultado mide es el desempeño colectivo: repartir
        # el mérito adentro del equipo es lo que hacen las evaluaciones y las
        # estadísticas, no esto.
        esperado = probabilidad_esperada(fuerza[equipo], fuerza[rival])
        real = resultado_real(goles[equipo], goles[rival])
        puntaje = puntaje_por_resultado(esperado, real, goles[equipo] - goles[rival])

        if equipo == EQUIPO_LOCAL:
            esperado_local = esperado

        for asignacion in jugadores:
            filas.append({
                "id": str(uuid.uuid4()),
                "match_id": match_id,
                "player_id": asignacion["player_id"],
                "team": equipo,
                "score": round(puntaje, 4),
                "expected": round(esperado, 4),
                "actual": real,
                "goal_diff": goles[equipo] - goles[rival],
                # Denormalizado a propósito: el cálculo del rating lo necesita
                # para pesar oficial y práctica distinto, y así se ahorra una
                # búsqueda del partido por cada fila.
                "match_type": match_type,
                "created_at": cuando,
            })

    await db.match_outcomes.delete_many({"match_id": match_id})
    if filas:
        await db.match_outcomes.insert_many(filas)

    # Se guarda con el resultado para poder mostrar en pantalla qué tan bien la
    # vio el balanceador. Es la única forma de que alguien se entere de que dijo
    # "parejo" y terminó 6 a 0.
    await db.matches.update_one(
        {"id": match_id},
        {"$set": {"result.expected_home": round(esperado_local, 4) if esperado_local is not None else None}},
    )

    return {"rows": len(filas), "expected_home": esperado_local}


async def borrar_outcomes(match_id: str) -> None:
    """Para cuando se borra el partido entero."""
    await db.match_outcomes.delete_many({"match_id": match_id})
