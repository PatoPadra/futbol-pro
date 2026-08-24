import React from 'react';
import { Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { GENEROS } from '@/constants/generos';

/**
 * Cómo quedó repartido cada género entre los dos equipos.
 *
 * Sólo aparece cuando el partido es MIXTO de verdad: si están todos en la misma
 * bolsa, una fila que dice "11 y 11" no informa nada y le roba espacio al resto
 * de la pantalla. Por eso el componente devuelve null solo cuando no hay mezcla.
 *
 * Los números salen de `team_summaries[X].gender_counts`, que el backend
 * recalcula desde las asignaciones: después de un ajuste manual esto sigue
 * diciendo la verdad y no lo que decidió el balanceador en su momento.
 */

// Se muestran las bolsas de reparto, no las opciones del perfil: "prefiero no
// decir" y "sin cargar" son la misma bolsa para el balanceador, así que en el
// reparto se cuentan juntas y se llaman "Sin declarar".
const BOLSAS = [
  ...GENEROS.filter((g) => g.id !== 'prefiero_no_decir').map((g) => ({
    key: g.id,
    label: g.label,
    claves: [g.id],
  })),
  { key: 'sin_declarar', label: 'Sin declarar', claves: ['prefiero_no_decir', 'sin_declarar'] },
];

function contar(counts, claves) {
  return claves.reduce((total, clave) => total + (counts?.[clave] || 0), 0);
}

export default function GenderSplit({ resumenA, resumenB, className, testId = 'gender-split' }) {
  const filas = BOLSAS.map((bolsa) => ({
    ...bolsa,
    a: contar(resumenA?.gender_counts, bolsa.claves),
    b: contar(resumenB?.gender_counts, bolsa.claves),
  })).filter((fila) => fila.a + fila.b > 0);

  // Una sola bolsa con gente = no hay mezcla que mostrar.
  if (filas.length < 2) return null;

  return (
    <div
      className={cn('rounded-3xl border border-slate-100 bg-white p-4 shadow-lift', className)}
      data-testid={testId}
    >
      <h3 className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-tight text-slate-900">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 place-items-center rounded-lg bg-turf/10 text-turf-accessible"
        >
          <Users className="h-4 w-4" />
        </span>
        Cómo quedó el mixto
      </h3>
      <p className="mt-1 text-xs text-slate-600">
        Los equipos se arman repartiendo cada género en partes iguales.
      </p>

      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Cantidad de jugadores de cada género en cada equipo</caption>
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
            <th scope="col" className="pb-1 text-left font-bold">Género</th>
            <th scope="col" className="pb-1 text-right font-bold">Equipo A</th>
            <th scope="col" className="pb-1 text-right font-bold">Equipo B</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.key} className="border-t border-slate-100">
              <th scope="row" className="py-1.5 text-left font-semibold text-slate-700">
                {fila.label}
              </th>
              <td className="py-1.5 text-right font-bold tabular-nums text-slate-900">{fila.a}</td>
              <td className="py-1.5 text-right font-bold tabular-nums text-slate-900">{fila.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
