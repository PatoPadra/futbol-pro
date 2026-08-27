"""
Borra un grupo entero usando la MISMA cascada que la app.

    # Ver qué se llevaría, sin escribir (default):
    backend/venv/Scripts/python.exe backend/scripts/borrar_grupo.py "test"

    # Hacerlo:
    backend/venv/Scripts/python.exe backend/scripts/borrar_grupo.py "test" --aplicar

POR QUÉ NO ES UN SCRIPT QUE BORRA A MANO. La cascada de un partido toca ocho
colecciones y además le devuelve el partido jugado al contador de cada
jugador. Escribir eso otra vez acá sería crear una segunda versión que puede
divergir de la de la app — que es exactamente el bug que la auditoría encontró:
borrar un partido limpiaba ocho colecciones y borrar un grupo limpiaba seis.

Así que esto importa `borrar_partidos` de `services/matches.py` y repite el
resto del borrado tal como lo hace la ruta. Si mañana aparece una colección
nueva que cuelgue de un partido, se agrega en un solo lugar y este script se
entera solo.

LO QUE NO HACE: borrar los perfiles de los jugadores. Un perfil puede estar en
varios grupos, así que borrarlo desde acá sería sacarlo de los otros. Para los
invitados de prueba que queden sueltos está `limpiar_datos_de_prueba.py`.
"""

from pathlib import Path
import argparse
import asyncio
import sys

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from database import db  # noqa: E402
from services.matches import COLECCIONES_DE_PARTIDO, borrar_partidos  # noqa: E402


async def buscar_grupo(referencia: str) -> dict | None:
    """Por id exacto o por nombre exacto."""
    por_id = await db.groups.find_one({"id": referencia}, {"_id": 0})
    if por_id:
        return por_id
    return await db.groups.find_one({"name": referencia}, {"_id": 0})


async def main() -> int:
    parser = argparse.ArgumentParser(description="Borra un grupo y todo lo que cuelga de él.")
    parser.add_argument("grupo", help="Nombre o id del grupo")
    parser.add_argument("--aplicar", action="store_true", help="Borra de verdad. Sin esto sólo muestra.")
    args = parser.parse_args()

    grupo = await buscar_grupo(args.grupo)
    if not grupo:
        print(f"No encontré ningún grupo llamado {args.grupo!r}")
        return 1

    print()
    print(f"BORRAR GRUPO {grupo['name']!r}")
    print("=" * 70)
    print("MODO:", "APLICAR (escribe)" if args.aplicar else "EN SECO (no escribe nada)")
    print()

    match_ids = [
        m["id"] for m in await db.matches.find({"group_id": grupo["id"]}, {"_id": 0, "id": 1}).to_list(2000)
    ]

    # La misma guarda que la ruta: un grupo que está jugando un torneo no se
    # borra, porque deja la llave inejecutable para los otros equipos.
    equipos = await db.tournament_teams.find({"group_id": grupo["id"]}, {"_id": 0, "tournament_id": 1}).to_list(50)
    if equipos:
        torneo_ids = sorted({e["tournament_id"] for e in equipos})
        en_juego = await db.tournaments.find(
            {"id": {"$in": torneo_ids}, "status": {"$ne": "finalizado"}}, {"_id": 0, "name": 1}
        ).to_list(50)
        if en_juego:
            nombres = ", ".join(f"«{t.get('name')}»" for t in en_juego)
            print(f"  ABORTADO: el grupo está jugando {nombres}.")
            print("  Sacalo del torneo antes de borrarlo.")
            return 1

    print(f"  Partidos: {len(match_ids)}")
    for coleccion in COLECCIONES_DE_PARTIDO:
        n = await db[coleccion].count_documents({"match_id": {"$in": match_ids}}) if match_ids else 0
        if n:
            print(f"    {coleccion:<24} {n}")

    miembros = await db.group_members.count_documents({"group_id": grupo["id"]})
    seeds = await db.group_seed_ratings.count_documents({"group_id": grupo["id"]})
    invitaciones = await db.group_invitations.count_documents({"group_id": grupo["id"]})
    print(f"  Membresías: {miembros}")
    print(f"  Puntajes iniciales: {seeds}")
    print(f"  Links de invitación: {invitaciones}")

    # A quién se le devuelve el partido jugado.
    devoluciones = 0
    for m in await db.matches.find({"id": {"$in": match_ids}}, {"_id": 0, "counted_player_ids": 1}).to_list(2000):
        devoluciones += len(m.get("counted_player_ids") or [])
    print(f"  Partidos jugados que se devuelven al contador: {devoluciones}")

    if not args.aplicar:
        print()
        print("=" * 70)
        print("  En seco: no se escribió nada. Volvé a correrlo con --aplicar.")
        print("=" * 70)
        print()
        return 0

    print()
    print("  Aplicando (misma cascada que la app)...")
    borrados = await borrar_partidos(match_ids)
    print(f"    partidos borrados: {borrados}")

    await db.tournament_teams.delete_many({"group_id": grupo["id"]})
    await db.group_invitations.delete_many({"group_id": grupo["id"]})
    await db.group_members.delete_many({"group_id": grupo["id"]})
    await db.group_seed_ratings.delete_many({"group_id": grupo["id"]})
    await db.groups.delete_one({"id": grupo["id"]})
    print(f"    grupo {grupo['name']!r} borrado")

    print()
    print("=" * 70)
    print("  Listo. Corré diagnostico_cierre_etapa.py para confirmar.")
    print("=" * 70)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
