import React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Qué estadísticas va a seguir el partido.
 *
 * Es una lista de tildes y no un multi-select porque la decisión no es "elegí de
 * esta lista": es "¿vas a estar dispuesto a cargar esto de dieciséis jugadores
 * cuando termine el partido?". Ver las diez opciones a la vez, con las dos
 * razonables ya tildadas, es lo que hace que esa pregunta se conteste sola.
 *
 * Las que no mueven el puntaje llevan una nota. No es un detalle menor: quien
 * tilda "duelos ganados" esperando que al jugador le suba el nivel merece saber
 * que eso no pasa, y por qué — cortes, duelos y regates miden cuánto tocás la
 * pelota, no qué tan bien jugás.
 */
export default function StatPicker({ stats = [], value = [], onChange, disabled = false, testId }) {
  if (!stats.length) return null;

  const elegidas = new Set(value);

  const alternar = (statId) => {
    if (disabled) return;
    const siguiente = new Set(elegidas);
    if (siguiente.has(statId)) siguiente.delete(statId);
    else siguiente.add(statId);
    // Se devuelve en el orden del catálogo y no en el de los clicks: así la
    // planilla del post partido siempre tiene las columnas en el mismo orden.
    onChange?.(stats.filter((s) => siguiente.has(s.id)).map((s) => s.id));
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid={testId}>
      {stats.map((stat) => {
        const tildada = elegidas.has(stat.id);
        const sumaPuntaje = Number(stat.bonus_weight) > 0;

        return (
          <button
            key={stat.id}
            type="button"
            role="checkbox"
            aria-checked={tildada}
            disabled={disabled}
            onClick={() => alternar(stat.id)}
            data-testid={`${testId || 'stat'}-${stat.id}`}
            className={cn(
              'flex items-start gap-2.5 rounded-xl border-2 p-2.5 text-left transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2',
              'motion-reduce:transition-none',
              tildada
                ? 'border-turf bg-turf/5'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border-2 transition-colors motion-reduce:transition-none',
                tildada ? 'border-turf bg-turf text-white' : 'border-slate-300 bg-white',
              )}
            >
              {tildada && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
            </span>

            <span className="min-w-0">
              <span
                className={cn(
                  'block text-sm font-semibold',
                  tildada ? 'text-turf-accessible' : 'text-slate-900',
                )}
              >
                {stat.name}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-600">
                {sumaPuntaje ? 'Suma al puntaje del jugador' : 'Sólo historial, no toca el puntaje'}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
