import React from 'react';

import { cn } from '@/lib/utils';

/**
 * Marca de asistencia de un jugador: vino, avisó que no venía, o plantó.
 *
 * Sin marcar NO es lo mismo que ausente. Sin marca significa "no se tomó
 * asistencia" y vale la regla de siempre (el titular jugó), así que el
 * organizador que no quiere saber nada de esto no tiene que tocar nada y el
 * partido cuenta igual que antes. Por eso el estado inicial es ninguno resaltado
 * y no "vino" preseleccionado: preseleccionar sería afirmar algo que nadie dijo.
 *
 * Tocar la marca activa la quita. Es la única forma de volver a "no se tomó
 * asistencia" después de haberse equivocado, y está escrito en el `title` porque
 * de otro modo no hay manera de adivinarlo.
 *
 * Los tres tonos son distintos entre sí, pero el texto siempre está escrito: el
 * color no es la única señal.
 */
const TONOS = {
  presente: 'border-turf bg-turf-btn text-white',
  ausente: 'border-amber-400 bg-amber-400 text-amber-950',
  sin_aviso: 'border-red-400 bg-red-500 text-white',
};

const INACTIVO =
  'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50';

export default function AttendanceControl({
  value,
  options = [],
  onChange,
  disabled = false,
  playerName,
  testId,
}) {
  if (!options.length) return null;

  return (
    <div
      role="group"
      aria-label={playerName ? `Asistencia de ${playerName}` : 'Asistencia'}
      className="flex flex-wrap gap-1"
      data-testid={testId}
    >
      {options.map((option) => {
        const activa = option.id === value;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={activa}
            disabled={disabled}
            // El texto corto entra en la fila; el largo es el que distingue de
            // verdad avisar de plantar, así que va al lector de pantalla.
            aria-label={`${option.name}${playerName ? ` — ${playerName}` : ''}`}
            title={activa ? 'Tocá de nuevo para quitar la marca' : option.name}
            onClick={() => onChange?.(activa ? null : option.id)}
            data-testid={`${testId || 'attendance'}-${option.id}`}
            className={cn(
              'min-h-[32px] rounded-full border px-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-1',
              'motion-reduce:transition-none',
              activa ? TONOS[option.id] || TONOS.presente : INACTIVO,
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {option.short || option.name}
          </button>
        );
      })}
    </div>
  );
}
