"""
Aplica los índices de INDEX_SPEC y verifica cuáles quedaron de verdad.

    backend/venv/Scripts/python.exe backend/scripts/aplicar_indices.py

Qué escribe: **sólo definiciones de índice**. No toca un solo documento. Lo
único destructivo posible es borrar un índice viejo para recrearlo como único,
que es reversible y no pierde datos.

Por qué existe teniendo `ensure_indexes` en el arranque de la app: porque ahí
falla en silencio. Si hay duplicados, el índice único no se crea, queda un
warning en un log que nadie mira, y la app sigue andando como si la garantía
existiera. Este script corre lo mismo y después va a fijarse QUÉ QUEDÓ, que es
la única forma de saberlo.

Correlo antes de deployar, y de nuevo después de cualquier cambio a INDEX_SPEC.
"""

import asyncio
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from database import INDEX_SPEC, db, ensure_indexes  # noqa: E402

ANCHO = 76


async def indices_actuales(coleccion: str) -> dict:
    """Los índices que existen hoy, por patrón de claves."""
    encontrados = {}
    try:
        async for idx in db[coleccion].list_indexes():
            if idx["name"] == "_id_":
                continue
            encontrados[tuple(dict(idx["key"]).items())] = idx
    except Exception as e:  # colección que todavía no existe
        if "not found" not in str(e).lower():
            raise
    return encontrados


async def main() -> int:
    print()
    print("APLICANDO ÍNDICES —", db.name)
    print("=" * ANCHO)

    esperados_unicos = [
        (coleccion, spec)
        for coleccion, specs in INDEX_SPEC.items()
        for spec in specs
        if spec.get("unique")
    ]
    print(f"Definiciones totales: {sum(len(s) for s in INDEX_SPEC.values())}")
    print(f"De ellas, únicas:     {len(esperados_unicos)}")
    print()

    await ensure_indexes()

    print()
    print("VERIFICACIÓN — ¿quedaron los únicos?")
    print("=" * ANCHO)

    faltantes = []
    for coleccion, spec in esperados_unicos:
        actuales = await indices_actuales(coleccion)
        patron = tuple((k, v) for k, v in spec["keys"])
        existente = actuales.get(patron)
        claves = ", ".join(k for k, _ in spec["keys"])
        etiqueta = f"{coleccion}({claves})"

        if existente and existente.get("unique"):
            parcial = " [parcial]" if existente.get("partialFilterExpression") else ""
            print(f"  [OK]      {etiqueta}{parcial}")
        elif existente:
            print(f"  [FALLO]   {etiqueta} existe pero NO es único")
            faltantes.append(etiqueta)
        else:
            print(f"  [FALLO]   {etiqueta} no existe")
            faltantes.append(etiqueta)

    print()
    print("=" * ANCHO)
    if faltantes:
        print(f"{len(faltantes)} índices únicos NO quedaron aplicados:")
        for f in faltantes:
            print(f"  · {f}")
        print()
        print("Casi seguro hay duplicados. Corré diagnostico_cierre_etapa.py,")
        print("resolvelos a mano, y volvé a correr esto.")
    else:
        print(f"Los {len(esperados_unicos)} índices únicos están aplicados.")
    print("=" * ANCHO)
    print()

    return 1 if faltantes else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
