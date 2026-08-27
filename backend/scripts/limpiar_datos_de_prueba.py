"""
Borra los datos sembrados para probar, sin tocar nada real.

    # Ver qué haría, sin escribir nada (default):
    backend/venv/Scripts/python.exe backend/scripts/limpiar_datos_de_prueba.py

    # Hacerlo de verdad:
    backend/venv/Scripts/python.exe backend/scripts/limpiar_datos_de_prueba.py --aplicar

POR QUÉ EXISTE. La app escribe `is_test_data: True` en los perfiles, membresías
e inscripciones que crea el sembrador del panel de admin, y hasta ahora nadie
leía ese campo ni lo limpiaba: los jugadores de prueba se quedaban conviviendo
con los de verdad para siempre. La auditoría lo marcó y esto lo cierra.

QUÉ NO HACE. No borra grupos ni partidos: para eso está la cascada de la app
(`delete_group`), que sabe llevarse las ocho colecciones que cuelgan de un
partido y devolver los partidos jugados al contador de cada uno. Si querés
sacarte de encima un grupo entero de prueba, borralo desde la app primero y
después corré esto para los perfiles que queden sueltos.

LA GUARDA QUE IMPORTA: nunca toca un perfil que tenga cuenta (`user_id`). Un
perfil de prueba es siempre un invitado sin cuenta; si alguno tuviera `user_id`
sería una persona de verdad mal marcada, y ahí preferimos no borrar y avisar.
"""

from pathlib import Path
import argparse
import os
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

BACKEND = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND / ".env")

# Todo lo que puede quedar apuntando a un perfil. Es la misma lista que usa la
# fusión de invitados, y por la misma razón: si mañana aparece una colección
# nueva que guarde un player_id, va acá.
REFERENCIAS = [
    ("match_registrations", "player_id"),
    ("group_members", "player_id"),
    ("peer_ratings", "rated_player_id"),
    ("peer_ratings", "rater_id"),
    ("group_seed_ratings", "rated_player_id"),
    ("group_seed_ratings", "rater_id"),
    ("stats_proposals", "player_id"),
    ("stats_final", "player_id"),
    ("match_outcomes", "player_id"),
    ("self_evaluations", "player_id"),
    ("player_match_notes", "player_id"),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Limpia los datos marcados como de prueba.")
    parser.add_argument(
        "--aplicar",
        action="store_true",
        help="Borra de verdad. Sin esto sólo muestra qué haría.",
    )
    args = parser.parse_args()

    cli = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=15000)
    db = cli[os.environ["DB_NAME"]]

    print()
    print("LIMPIEZA DE DATOS DE PRUEBA —", db.name)
    print("=" * 70)
    print("MODO:", "APLICAR (escribe)" if args.aplicar else "EN SECO (no escribe nada)")
    print()

    perfiles = list(db.player_profiles.find({"is_test_data": True}, {"_id": 0, "id": 1, "name": 1, "user_id": 1}))
    if not perfiles:
        print("  No hay perfiles marcados como de prueba. Nada que hacer.")
        cli.close()
        return 0

    con_cuenta = [p for p in perfiles if p.get("user_id")]
    if con_cuenta:
        print("  ABORTADO. Estos perfiles están marcados como de prueba pero tienen")
        print("  cuenta asociada, o sea que son personas de verdad mal marcadas:")
        for p in con_cuenta:
            print(f"    · {p.get('name')} ({p['id']})")
        print()
        print("  Sacales la marca `is_test_data` a mano y volvé a correr esto.")
        cli.close()
        return 1

    ids = [p["id"] for p in perfiles]
    print(f"  Perfiles de prueba a borrar: {len(ids)}")
    for p in perfiles[:8]:
        print(f"    · {p.get('name')}")
    if len(perfiles) > 8:
        print(f"    … y {len(perfiles) - 8} más")

    print()
    print("  Referencias que se van con ellos:")
    total = 0
    for coleccion, campo in REFERENCIAS:
        n = db[coleccion].count_documents({campo: {"$in": ids}})
        total += n
        if n:
            print(f"    {coleccion}.{campo:<20} {n}")
    if total == 0:
        print("    (ninguna: estos perfiles ya no los nombra nadie)")

    # Los que aparecen dentro de una alineación se avisan aparte: ahí borrar el
    # perfil deja el equipo de aquel partido con un jugador menos, que es
    # exactamente lo que NO queremos hacerle a un partido real.
    en_equipos = db.team_generations.count_documents({"assignments.player_id": {"$in": ids}})
    if en_equipos:
        print()
        print(f"  OJO: {en_equipos} generaciones de equipos los nombran. Si esos partidos")
        print("  son reales, borrá el GRUPO desde la app en vez de correr esto: la")
        print("  cascada sabe llevarse el partido entero y dejar todo consistente.")

    if not args.aplicar:
        print()
        print("=" * 70)
        print("  En seco: no se escribió nada. Volvé a correrlo con --aplicar.")
        print("=" * 70)
        print()
        cli.close()
        return 0

    print()
    print("  Aplicando...")
    for coleccion, campo in REFERENCIAS:
        r = db[coleccion].delete_many({campo: {"$in": ids}})
        if r.deleted_count:
            print(f"    {coleccion}.{campo}: {r.deleted_count} borrados")

    r = db.player_profiles.delete_many({"id": {"$in": ids}})
    print(f"    player_profiles: {r.deleted_count} borrados")

    print()
    print("=" * 70)
    print("  Listo. Corré diagnostico_cierre_etapa.py para confirmar que")
    print("  no quedaron huérfanos.")
    print("=" * 70)
    print()

    cli.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
