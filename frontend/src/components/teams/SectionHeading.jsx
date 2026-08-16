import React from 'react';

import { cn } from '@/lib/utils';

/**
 * Encabezado de seccion con el icono en un chip.
 *
 * Existe para que las tres pantallas del post partido tengan la misma jerarquia:
 * chip con icono, titulo condensado en mayusculas, y una linea de contexto. Sin
 * esto cada tarjeta inventaba su propio titulo y la pagina se leia como una pila
 * de bloques sueltos.
 */
const TONOS = {
  turf: 'bg-turf/10 text-turf-accessible',
  orange: 'bg-orange/15 text-orange-accessible',
  slate: 'bg-slate-100 text-slate-700',
};

export default function SectionHeading({
  icono: Icono,
  titulo,
  bajada,
  /** Chips o botones a la derecha. */
  acciones,
  tono = 'turf',
  className,
  testId,
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)} data-testid={testId}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {Icono && (
          <span
            aria-hidden="true"
            className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', TONOS[tono] || TONOS.turf)}
          >
            <Icono className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-bold uppercase leading-tight tracking-tight text-slate-900">
            {titulo}
          </h2>
          {bajada && <p className="mt-1 text-sm leading-relaxed text-slate-600">{bajada}</p>}
        </div>
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
