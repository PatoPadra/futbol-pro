"""
Diagnóstico de cierre de etapa — SOLO LECTURA.

Cómo correrlo, parado en la raíz del proyecto:

    backend/venv/Scripts/python.exe backend/scripts/diagnostico_cierre_etapa.py

No hace falta instalar nada: usa el pymongo que ya está en el venv y lee la
conexión del `backend/.env` que ya existe. Es la misma cosa que el `.js`
hermano, para el caso de no tener mongosh a mano.

**No escribe.** Son find/aggregate/count y nada más. Se puede correr contra
producción sin backup previo y sin ventana de mantenimiento. Por las dudas, el
cliente se abre con permisos de lectura en la medida en que el driver lo
permite, y no hay una sola llamada a insert/update/delete en todo el archivo.

Para qué: la auditoría de cierre de etapa encontró bugs que corrompen datos en
silencio. Esto mide CUÁNTO daño hay antes de tocar los datos. Las fases de
reparación tienen condiciones de entrada que se leen de acá — sobre todo la de
índices únicos, que falla si quedan duplicados, y falla callada porque
`ensure_indexes` está envuelto en try/except.

Guardá la salida: es la línea de base contra la que se verifica cada fase.
"""

from pathlib import Path
import os
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

RAIZ = Path(__file__).resolve().parents[1]
load_dotenv(RAIZ / ".env")

ANCHO = 72
resumen = {"ok": 0, "revisar": 0}


def titulo(n, texto):
    print()
    print("=" * ANCHO)
    print(f"Q{n}  {texto}")
    print("=" * ANCHO)


def veredicto(bien, mensaje_ok, mensaje_mal):
    if bien:
        resumen["ok"] += 1
        print(f"  [OK]      {mensaje_ok}")
    else:
        resumen["revisar"] += 1
        print(f"  [REVISAR] {mensaje_mal}")


def muestra(items, limite=5):
    if not items:
        return
    print(f"  Muestra (hasta {limite}):")
    for item in items[:limite]:
        print(f"    {item}")
    if len(items) > limite:
        print(f"    … y {len(items) - limite} más")


def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("Falta MONGO_URL o DB_NAME en backend/.env", file=sys.stderr)
        return 1

    cliente = MongoClient(mongo_url, serverSelectionTimeoutMS=15000)
    db = cliente[db_name]

    print()
    print("DIAGNÓSTICO DE CIERRE DE ETAPA — futbol-pro")
    # A propósito sólo el nombre de la base: la URL lleva credenciales.
    print(f"Base: {db_name}")

    # ---------------------------------------------------------------- #
    # BLOQUE A — El player_score congelado
    # ---------------------------------------------------------------- #

    titulo(1, "Generaciones de equipos con player_score nulo o ausente")
    filas = list(db.team_generations.aggregate([
        {"$project": {
            "_id": 0,
            "match_id": 1,
            "total": {"$size": "$assignments"},
            "sin": {"$size": {"$filter": {
                "input": "$assignments",
                "as": "a",
                "cond": {"$not": [{"$isNumber": "$$a.player_score"}]},
            }}},
        }},
        {"$match": {"sin": {"$gt": 0}}},
        {"$group": {
            "_id": {"todos": {"$eq": ["$sin", "$total"]}},
            "n": {"$sum": 1},
            "ejemplos": {"$push": "$match_id"},
        }},
    ]))
    total_sin = sum(f["n"] for f in filas)
    print(f"  Generaciones con algún score faltante: {total_sin}")
    for f in filas:
        etiqueta = (
            "TODOS los jugadores sin score (equipos enteros al prior neutro)"
            if f["_id"]["todos"]
            else "algunos sin score (tuerce la fuerza de un solo lado)"
        )
        print(f"    · {f['n']} — {etiqueta}")
        muestra(f["ejemplos"], 3)
    veredicto(
        total_sin == 0,
        "todas las generaciones tienen el puntaje congelado",
        f"{total_sin} generaciones dependían del recálculo en vivo: son las que se corrompen al tocar los equipos.",
    )

    titulo(2, "Generaciones con todos los player_score idénticos (síntoma del fallback)")
    sospechosas = list(db.team_generations.aggregate([
        {"$project": {
            "_id": 0,
            "match_id": 1,
            "n": {"$size": "$assignments"},
            "distintos": {"$size": {"$setUnion": "$assignments.player_score"}},
        }},
        {"$match": {"distintos": {"$lte": 1}, "n": {"$gt": 1}}},
    ]))
    print(f"  Generaciones sospechosas: {len(sospechosas)}")
    muestra(sospechosas)
    veredicto(
        not sospechosas,
        "ninguna generación tiene los puntajes aplastados a un solo valor",
        f"{len(sospechosas)} generaciones tienen un único valor para todo el plantel: su expected_home es un 0.5 fabricado.",
    )

    titulo(3, "Efecto en match_outcomes: expected clavado en 0.5")
    # Un partido genuinamente parejo da 0.4987 o 0.5031, nunca 0.5000 exacto:
    # el promedio de fuerzas suma floats distintos. El 0.5 clavado sólo sale de
    # que los dos promedios sean idénticos, y la única forma sistemática de que
    # eso pase es que ambos hayan caído al mismo prior neutro.
    exactos = db.match_outcomes.count_documents({"expected": 0.5})
    partidos_05 = db.matches.count_documents({"result.expected_home": 0.5})
    print(f"  Filas de match_outcomes con expected == 0.5 exacto: {exactos}")
    print(f"  Partidos con result.expected_home == 0.5 exacto:    {partidos_05}")
    veredicto(
        exactos == 0 and partidos_05 == 0,
        "ningún puntaje se calculó sobre una expectativa fabricada",
        "hay puntaje repartido con expected 0.5. En un 1-0 eso da 7.30 al ganador y 2.70 al perdedor: "
        "el sistema declaró 'sorpresa' en partidos que no lo fueron.",
    )

    titulo(4, "Generaciones que pasaron por el cliente (marcador forense: player_age)")
    # team_balancer NUNCA escribe player_age: sólo lo agrega _enrich_assignments
    # al responder el GET. Un assignment guardado que lo tenga volvió sí o sí
    # por el round-trip del cliente, o sea que pasó por adjust_teams.
    tocados = db.team_generations.distinct("match_id", {"assignments.player_age": {"$exists": True}})
    print(f"  Generaciones que volvieron por el cliente: {len(tocados)}")
    outcomes_tocados = db.match_outcomes.count_documents({"match_id": {"$in": tocados}}) if tocados else 0
    con_resultado = db.matches.count_documents(
        {"id": {"$in": tocados}, "result.expected_home": {"$ne": None}}
    ) if tocados else 0
    print(f"  De esos, con puntaje ya repartido (match_outcomes): {outcomes_tocados}")
    print(f"  De esos, con resultado cargado:                     {con_resultado}")
    print("  Nota: el marcador es de una sola dirección. Captura todo lo que pasó por")
    print("  adjust_teams, pero un cliente que mande player_age nulo también queda")
    print("  marcado. Preferible ese falso positivo a un falso negativo.")
    veredicto(
        outcomes_tocados == 0,
        "ningún puntaje se calculó sobre equipos que pasaron por el cliente",
        f"{outcomes_tocados} filas de puntaje salieron de partidos ajustados a mano: su expectativa puede estar contaminada.",
    )

    # ---------------------------------------------------------------- #
    # BLOQUE B — Duplicados que bloquean los índices únicos
    #
    # PRECONDICIÓN DURA de la fase de blindaje: las cuatro tienen que dar cero
    # antes de crear un índice unique.
    # ---------------------------------------------------------------- #

    titulo(5, "Perfiles con el mismo user_id (bloquea unique en player_profiles)")
    dup_users = list(db.player_profiles.aggregate([
        {"$match": {"user_id": {"$type": "string"}}},
        {"$group": {"_id": "$user_id", "n": {"$sum": 1}, "ids": {"$push": "$id"}}},
        {"$match": {"n": {"$gt": 1}}},
    ]))
    print(f"  Usuarios con más de un perfil: {len(dup_users)}")
    muestra(dup_users)
    veredicto(
        not dup_users,
        "cada usuario tiene un solo perfil",
        f"{len(dup_users)} usuarios tienen el historial partido al medio: find_one devuelve uno arbitrario.",
    )

    titulo(6, "Dobles inscripciones activas al mismo partido")
    dup_regs = list(db.match_registrations.aggregate([
        {"$match": {"status": {"$ne": "baja"}}},
        {"$group": {
            "_id": {"match_id": "$match_id", "player_id": "$player_id"},
            "n": {"$sum": 1},
            "ids": {"$push": "$id"},
        }},
        {"$match": {"n": {"$gt": 1}}},
    ]))
    print(f"  Pares (partido, jugador) duplicados: {len(dup_regs)}")
    muestra(dup_regs)
    veredicto(
        not dup_regs,
        "nadie está anotado dos veces al mismo partido",
        f"{len(dup_regs)} casos: ese jugador se cuenta doble en el cupo, aparece dos veces en el balanceador "
        "y suma dos partidos jugados.",
    )

    titulo(7, "Dobles membresías al mismo grupo")
    # Sin filtrar por status a propósito: add_group_member reusa el doc
    # existente, así que el índice va sobre (group_id, player_id) sin importar
    # el estado.
    dup_miembros = list(db.group_members.aggregate([
        {"$group": {
            "_id": {"group_id": "$group_id", "player_id": "$player_id"},
            "n": {"$sum": 1},
            "estados": {"$push": "$status"},
            "ids": {"$push": "$id"},
        }},
        {"$match": {"n": {"$gt": 1}}},
    ]))
    print(f"  Pares (grupo, jugador) duplicados: {len(dup_miembros)}")
    muestra(dup_miembros)
    veredicto(
        not dup_miembros,
        "una membresía por persona por grupo",
        f"{len(dup_miembros)} casos bloquean el índice único.",
    )

    titulo(8, "Invitados distintos compartiendo email")
    dup_invitados = list(db.player_profiles.aggregate([
        {"$match": {"player_type": "invitado", "user_id": None, "email": {"$ne": None}}},
        {"$group": {"_id": "$email", "n": {"$sum": 1}, "ids": {"$push": "$id"}}},
        {"$match": {"n": {"$gt": 1}}},
    ]))
    print(f"  Emails con más de un invitado: {len(dup_invitados)}")
    muestra(dup_invitados)
    veredicto(
        not dup_invitados,
        "ningún email tiene dos invitados",
        f"{len(dup_invitados)} personas van a recuperar sólo una mitad de su historial al registrarse, y en silencio.",
    )

    # ---------------------------------------------------------------- #
    # BLOQUE C — Estados imposibles y huérfanos
    # ---------------------------------------------------------------- #

    titulo(9, "Partidos en estado imposible")
    CATALOGO = {
        "abierto", "cerrado", "equipos_generados", "equipos_confirmados",
        "finalizado", "completado", "cancelado",
    }
    por_estado = list(db.matches.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]))
    print("  Distribución de estados:")
    for e in sorted(por_estado, key=lambda x: -x["n"]):
        print(f"    · {e['_id']}: {e['n']}")
    fuera = [e for e in por_estado if e["_id"] not in CATALOGO]
    if fuera:
        print(f"  Estados FUERA del catálogo: {fuera}")

    fin_sin_conteo = db.matches.count_documents({
        "status": {"$in": ["finalizado", "completado"]},
        "counted_player_ids": {"$size": 0},
    })
    # La prueba directa del bug de transiciones: un partido abierto o cerrado
    # con gente ya contada estuvo finalizado y volvió atrás.
    abierto_con_conteo = db.matches.count_documents({
        "status": {"$in": ["abierto", "cerrado"]},
        "counted_player_ids": {"$not": {"$size": 0}},
    })
    print(f"  Finalizados sin jugadores contados:        {fin_sin_conteo}")
    print(f"  Abiertos/cerrados CON jugadores contados:  {abierto_con_conteo}   <-- volvieron atrás")
    veredicto(
        not fuera and abierto_con_conteo == 0,
        "ningún partido volvió atrás desde finalizado y no hay estados inventados",
        f"{abierto_con_conteo} partidos retrocedieron de estado. Mientras estuvieron así, los seis endpoints "
        "de post-partido quedaron cerrados sobre datos ya cargados.",
    )

    titulo(10, "Huérfanos de merge de invitados y de borrado de grupo")
    perfiles_vivos = db.player_profiles.distinct("id")
    partidos_vivos = db.matches.distinct("id")
    grupos_vivos = db.groups.distinct("id")

    checks = [
        ("match_outcomes de jugadores que ya no existen",
         db.match_outcomes.count_documents({"player_id": {"$nin": perfiles_vivos}}), "daño del merge"),
        ("self_evaluations de jugadores inexistentes",
         db.self_evaluations.count_documents({"player_id": {"$nin": perfiles_vivos}}), ""),
        ("peer_ratings con rater inexistente",
         db.peer_ratings.count_documents({"rater_id": {"$nin": perfiles_vivos}}), ""),
        ("player_match_notes de jugadores inexistentes",
         db.player_match_notes.count_documents({"player_id": {"$nin": perfiles_vivos}}), ""),
        ("match_outcomes de partidos borrados",
         db.match_outcomes.count_documents({"match_id": {"$nin": partidos_vivos}}), "daño del borrado de grupo"),
        ("tournament_teams de grupos borrados",
         db.tournament_teams.count_documents({"group_id": {"$nin": grupos_vivos}}), "torneo inejecutable"),
    ]
    for etiqueta, cantidad, nota in checks:
        sufijo = f"   <-- {nota}" if nota else ""
        print(f"  {etiqueta:<48} {cantidad}{sufijo}")

    total_huerfanos = sum(c for _, c, _ in checks)
    veredicto(
        total_huerfanos == 0,
        "no hay referencias colgadas",
        f"{total_huerfanos} documentos huérfanos. Los match_outcomes huérfanos los sigue leyendo el cálculo de "
        "rating por player_id: hay gente arrastrando puntaje de partidos que ya no existen.",
    )

    # ---------------------------------------------------------------- #

    print()
    print("=" * ANCHO)
    print(f"RESUMEN — {resumen['ok']} en OK, {resumen['revisar']} para revisar")
    print("=" * ANCHO)
    print()
    print("Cómo leerlo:")
    print("  · Q1-Q4 miden el daño del player_score. Si Q4 da 0 outcomes, el histórico está")
    print("    limpio y la discusión sobre cómo repararlo se vuelve académica.")
    print("  · Q5-Q8 son la precondición de los índices únicos: tienen que dar CERO antes de crearlos.")
    print("  · Q9 dice si el bug de transiciones ya se manifestó.")
    print("  · Q10 cuantifica lo que el merge y el borrado de grupo dejaron colgado.")
    print()

    cliente.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
