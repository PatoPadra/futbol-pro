import React from 'react';

import { cn } from '@/lib/utils';

/**
 * Barra de progreso decorativa (votos juntados, evaluaciones guardadas).
 *
 * Va con `aria-hidden` a proposito: quien la use tiene que poner al lado el
 * texto con los numeros ("3/5 votos"), porque una barra sola no se puede leer
 * con lector de pantalla ni se entiende en escala de grises.
 */
export default function ProgressTrack({ valor = 0, total = 0, alto = 'h-2', barraClassName, className }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((valor / total) * 100))) : 0;

  return (
    <div
      aria-hidden="true"
      className={cn('overflow-hidden rounded-full bg-slate-200', alto, className)}
    >
      <div
        className={cn(
          'h-full rounded-full bg-turf [transition-duration:600ms] transition-[width] ease-out motion-reduce:transition-none',
          barraClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
