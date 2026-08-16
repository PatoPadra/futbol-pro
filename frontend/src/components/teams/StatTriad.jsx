import React from 'react';
import { Hand, Target, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Goles, asistencias y atajadas de una propuesta, siempre las tres y siempre en
 * el mismo orden.
 *
 * Antes se escondian las que estaban en cero, y eso hacia imposible comparar dos
 * propuestas del mismo jugador: una fila con dos chips y otra con tres no se
 * leen en paralelo. Ahora el cero se muestra apagado, que ademas es informacion
 * ("propuso cero goles" no es lo mismo que "no dijo nada").
 */
const CAMPOS = [
  { key: 'goals', label: 'Goles', corto: 'G', icono: Target },
  { key: 'assists', label: 'Asistencias', corto: 'A', icono: Users },
  { key: 'saves', label: 'Atajadas', corto: 'At', icono: Hand },
];

export default function StatTriad({ goals = 0, assists = 0, saves = 0, className }) {
  const valores = { goals: goals || 0, assists: assists || 0, saves: saves || 0 };

  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {CAMPOS.map(({ key, label, corto, icono: Icono }) => {
        const valor = valores[key];
        const activo = valor > 0;
        return (
          <li
            key={key}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
              activo
                ? 'border-turf/25 bg-turf/10 text-turf-accessible'
                : 'border-slate-200 bg-slate-50 text-slate-500',
            )}
          >
            <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="text-sm font-bold tabular-nums">{valor}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide" aria-hidden="true">{corto}</span>
            <span className="sr-only">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
