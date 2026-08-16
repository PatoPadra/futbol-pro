import React from 'react';

import { cn } from '@/lib/utils';

/**
 * Panel de sección para el flujo de partido.
 *
 * Existe para que el detalle del partido y el formulario de creación dejen de
 * ser una pila de secciones sueltas sobre blanco. Cada bloque queda con su
 * encabezado propio: ícono en chip de color, título en `font-heading`, una línea
 * de contexto y, si hace falta, acciones a la derecha.
 *
 * El chip de color es decorativo — el título siempre dice de qué se trata.
 */
const TONOS = {
  turf: 'bg-turf/10 text-turf-accessible',
  orange: 'bg-orange/10 text-orange-accessible',
  slate: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-50 text-red-600',
};

export default function Panel({
  icono: Icono,
  titulo,
  /** Contador o valor al lado del título, en grande. */
  contador,
  bajada,
  /** Botones del encabezado, a la derecha. */
  acciones,
  tono = 'turf',
  /** Sin padding en el cuerpo: para listas que llevan sus propias filas. */
  className,
  contentClassName,
  testId,
  children,
}) {
  return (
    <section
      className={cn(
        // Alineado con groups/SectionPanel y panels/PanelSection: mismo rol,
        // misma sombra. Antes era shadow-sm y se veia mas plano que los otros.
        'overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lift',
        className,
      )}
      data-testid={testId}
    >
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {Icono && (
              <span
                aria-hidden="true"
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                  TONOS[tono] || TONOS.turf,
                )}
              >
                <Icono className="h-[18px] w-[18px]" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-baseline gap-2 font-heading text-base font-bold uppercase tracking-tight text-slate-900 sm:text-lg">
                {titulo}
                {contador != null && (
                  <span className="font-heading text-sm font-bold tabular-nums text-slate-500">
                    {contador}
                  </span>
                )}
              </h2>
              {bajada && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{bajada}</p>}
            </div>
          </div>
          {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
        </header>
      )}
      <div className={cn('p-4 sm:p-5', contentClassName)}>{children}</div>
    </section>
  );
}
