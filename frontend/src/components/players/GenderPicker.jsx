import React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { GENEROS } from '@/constants/generos';

/**
 * Selector de género: cuatro botones, uno solo elegido.
 *
 * Botones y no un `<select>`: son cuatro opciones fijas y cortas, y desde el
 * celular un desplegable nativo cuesta dos toques y tapa la pantalla. Sigue la
 * misma anatomía que PositionPicker (sigla en un cuadrado + etiqueta) para que
 * el paso de datos del onboarding se lea como una sola cosa.
 *
 * `onChange(id)` recibe el id elegido, o `''` si se vuelve a tocar el que ya
 * estaba: poder desmarcar importa porque el campo es opcional en la edición del
 * perfil, y sin eso no habría forma de volver atrás una vez cargado.
 */
export default function GenderPicker({
  value,
  onChange,
  disabled = false,
  testIdPrefix = 'gender',
  ariaLabel = 'Género',
  className,
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="group" aria-label={ariaLabel}>
      {GENEROS.map((g) => {
        const activo = value === g.id;
        return (
          <button
            key={g.id}
            type="button"
            data-testid={`${testIdPrefix}-${g.id}`}
            aria-pressed={activo}
            disabled={disabled}
            onClick={() => onChange(activo ? '' : g.id)}
            className={cn(
              'inline-flex min-h-[48px] items-center gap-2 rounded-2xl border bg-white pl-1.5 pr-3.5 text-left text-sm font-semibold text-slate-700',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
              activo
                ? 'border-turf bg-turf-btn text-white shadow-lift-turf'
                : 'border-slate-200 hover:border-turf/60 hover:bg-turf/5',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-xl font-heading text-[13px] font-bold uppercase leading-none',
                activo ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
              )}
            >
              {g.corto}
            </span>
            <span className="leading-tight">{g.label}</span>
            {activo && <Check className="ml-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
