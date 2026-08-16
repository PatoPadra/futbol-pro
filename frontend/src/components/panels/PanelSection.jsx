import React from 'react';

import { cn } from '@/lib/utils';

/**
 * Panel de contenido para las herramientas de trabajo (admin y organizador).
 *
 * Los dos paneles venian como una pila de tarjetas sueltas sobre blanco: sin
 * borde de seccion no hay forma de saber donde termina una lista y arranca la
 * siguiente. Esto le pone a cada bloque un encabezado con icono en chip, una
 * bajada opcional y un lugar fijo para las acciones de la derecha.
 *
 * A proposito NO usa foto: son pantallas de trabajo, no vidriera. La identidad
 * la pone el PageHeader de arriba una sola vez.
 */
const TONOS = {
  slate: 'bg-slate-200/70 text-slate-700',
  turf: 'bg-turf/10 text-turf-accessible',
  orange: 'bg-orange/10 text-orange-accessible',
  charcoal: 'bg-secondary/10 text-secondary',
};

export default function PanelSection({
  /** Icono de lucide para el chip del encabezado. */
  icono: Icono,
  titulo,
  /** Una linea corta: que hay en este panel. */
  descripcion,
  /** Contador a la derecha del titulo (numeros alineados). */
  contador,
  /** Botones o filtros del encabezado. */
  acciones,
  /** 'slate' | 'turf' | 'orange' | 'charcoal' */
  tono = 'slate',
  /** Quita el padding interno: para listas que llegan a los bordes. */
  sinPadding = false,
  className,
  children,
  testId,
  ...rest
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lift',
        className,
      )}
      data-testid={testId}
      {...rest}
    >
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 md:px-5">
          {Icono && (
            <span
              aria-hidden="true"
              className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', TONOS[tono] || TONOS.slate)}
            >
              <Icono className="h-4 w-4" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="flex items-baseline gap-2 font-heading text-lg font-bold uppercase leading-none tracking-tight text-slate-900">
              <span className="truncate">{titulo}</span>
              {contador != null && (
                <span className="shrink-0 font-body text-xs font-semibold tabular-nums text-slate-500">
                  {contador}
                </span>
              )}
            </h2>
            {descripcion && (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{descripcion}</p>
            )}
          </div>

          {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
        </header>
      )}

      <div className={cn(!sinPadding && 'p-4 md:p-5')}>{children}</div>
    </section>
  );
}
