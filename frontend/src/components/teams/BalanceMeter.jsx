import React from 'react';
import { Scale } from 'lucide-react';

import { cn } from '@/lib/utils';
import TeamCrest from './TeamCrest';
import { TEAM_IDENTITY } from './teamIdentity';

/**
 * Como quedo repartida la fuerza entre los dos equipos.
 *
 * El porcentaje de balance solo no dice para que lado se fue la balanza, asi
 * que cuando hay valores de los dos equipos (los ve el organizador) se dibuja
 * la reparticion real con los escudos en cada punta. El numero grande queda
 * igual para quien no tiene los valores.
 */
function tono(pct) {
  if (pct >= 85) return { texto: 'text-turf-accessible', chip: 'bg-turf/10 border-turf/25', etiqueta: 'Muy parejo' };
  if (pct >= 70) return { texto: 'text-orange-accessible', chip: 'bg-orange/10 border-orange/25', etiqueta: 'Aceptable' };
  return { texto: 'text-slate-700', chip: 'bg-slate-100 border-slate-200', etiqueta: 'Desparejo' };
}

export default function BalanceMeter({ pct = 0, valorA, valorB, className, testId }) {
  const t = tono(pct);
  const tieneValores = typeof valorA === 'number' && typeof valorB === 'number' && (valorA + valorB) > 0;
  const parteA = tieneValores ? Math.round((valorA / (valorA + valorB)) * 100) : 50;

  return (
    <div
      className={cn('rounded-3xl border border-slate-200 bg-white p-4 shadow-lift sm:p-5', className)}
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl border', t.chip)}>
          <Scale className={cn('h-5 w-5', t.texto)} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">Balance del reparto</p>
          <p className="text-sm text-slate-600">{t.etiqueta}</p>
        </div>
        <p className={cn('font-heading text-4xl font-bold leading-none tabular-nums', t.texto)}>
          {pct}
          <span className="text-xl">%</span>
        </p>
      </div>

      {tieneValores && (
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <TeamCrest team="A" tamanio="xs" />
            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <div className={cn('h-full', TEAM_IDENTITY.A.barra)} style={{ width: `${parteA}%` }} />
              <div className={cn('h-full flex-1', TEAM_IDENTITY.B.barra)} />
            </div>
            <TeamCrest team="B" tamanio="xs" />
          </div>
          <p className="mt-2 text-center text-xs text-slate-600">
            Valor total: <span className="font-semibold text-slate-900">{valorA.toFixed(2)}</span> del equipo A
            {' contra '}
            <span className="font-semibold text-slate-900">{valorB.toFixed(2)}</span> del equipo B
          </p>
        </div>
      )}
    </div>
  );
}
