import React from 'react';
import { AlertTriangle, Hand, Target, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Las estadísticas de una fila, siempre todas y siempre en el mismo orden.
 *
 * El cero se muestra apagado en vez de esconderse, y eso es a propósito: dos
 * propuestas del mismo jugador con distinta cantidad de chips no se pueden leer
 * en paralelo, y además "propuso cero goles" no es lo mismo que "no dijo nada".
 *
 * Dejó de ser fija en goles/asistencias/atajadas cuando las estadísticas pasaron
 * a elegirse por partido: ahora las columnas se las dicta quien la usa. El
 * nombre quedó, aunque ya no sean tres.
 *
 * Las negativas (faltas, tarjetas) van en tono ámbar. Una amarilla no se pinta
 * de verde como si fuera un logro.
 */
const ICONOS = {
  goals: Target,
  assists: Users,
  saves: Hand,
};

/** Las tres de siempre, para quien todavía la use con los props viejos. */
const CLASICAS = [
  { id: 'goals', name: 'Goles', short: 'G' },
  { id: 'assists', name: 'Asistencias', short: 'A' },
  { id: 'saves', name: 'Atajadas', short: 'At' },
];

export default function StatTriad({
  /** {stat_id: valor}. Es la forma nueva. */
  values,
  /** Definiciones del catálogo: [{id, name, short, negative}]. */
  stats,
  // Props viejos, por si queda alguna llamada sin migrar.
  goals,
  assists,
  saves,
  className,
}) {
  const definiciones = stats?.length ? stats : CLASICAS;
  const valores = values || { goals: goals || 0, assists: assists || 0, saves: saves || 0 };

  if (!definiciones.length) return null;

  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {definiciones.map((stat) => {
        const valor = Number(valores[stat.id]) || 0;
        const activo = valor > 0;
        const Icono = ICONOS[stat.id] || (stat.negative ? AlertTriangle : null);

        return (
          <li
            key={stat.id}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
              !activo && 'border-slate-200 bg-slate-50 text-slate-600',
              activo && stat.negative && 'border-amber-300 bg-amber-50 text-amber-800',
              activo && !stat.negative && 'border-turf/25 bg-turf/10 text-turf-accessible',
            )}
          >
            {Icono && <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            <span className="text-sm font-bold tabular-nums">{valor}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide" aria-hidden="true">
              {stat.short || stat.id}
            </span>
            <span className="sr-only">{stat.name || stat.id}</span>
          </li>
        );
      })}
    </ul>
  );
}
