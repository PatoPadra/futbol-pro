import React from 'react';

import { cn } from '@/lib/utils';

/**
 * Fila de contadores para los paneles de trabajo.
 *
 * Sobrios a proposito: nada de gradientes ni fotos. Lo que tiene que saltar es
 * el numero, asi que va en `font-heading` grande y con `tabular-nums` para que
 * los digitos queden en columna cuando cambian (si no, el 1 es mas angosto y
 * los tiles bailan cada vez que se recarga).
 */
const TONOS = {
  slate: { chip: 'bg-slate-200/70 text-slate-700', barra: 'bg-slate-300' },
  turf: { chip: 'bg-turf/10 text-turf-accessible', barra: 'bg-turf' },
  orange: { chip: 'bg-orange/10 text-orange-accessible', barra: 'bg-orange' },
  charcoal: { chip: 'bg-secondary/10 text-secondary', barra: 'bg-secondary' },
};

export default function MetricTiles({
  /** [{ key, label, value, icon, tone, testId }] */
  items = [],
  className,
}) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6',
        className,
      )}
    >
      {items.map((it) => {
        const tono = TONOS[it.tone] || TONOS.slate;
        const Icono = it.icon;

        return (
          <div
            key={it.key}
            data-testid={it.testId}
            className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-sm"
          >
            <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-0.5', tono.barra)} />

            <div className="flex items-start justify-between gap-2">
              <p className="font-heading text-3xl font-bold leading-none tabular-nums text-slate-900">
                {it.value ?? 0}
              </p>
              {Icono && (
                <span
                  aria-hidden="true"
                  className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', tono.chip)}
                >
                  <Icono className="h-3.5 w-3.5" />
                </span>
              )}
            </div>

            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              {it.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
