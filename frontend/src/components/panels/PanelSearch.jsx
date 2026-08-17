import React from 'react';
import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/**
 * Buscador de los paneles. Existia repetido en admin (dos veces) y organizador
 * con el mismo bloque de icono absoluto; aca queda una sola vez, con label
 * accesible de verdad (antes el unico texto era el placeholder, que los
 * lectores de pantalla no anuncian de forma confiable) y un contador de
 * resultados en vivo para que quede claro que la lista se filtro.
 *
 * `onLimpiar` es opcional: si no lo pasas, no hay boton de limpiar. No toca el
 * valor por su cuenta.
 */
export default function PanelSearch({
  id,
  /** Texto del label (queda oculto visualmente, no del lector de pantalla). */
  label,
  value,
  onChange,
  placeholder,
  /** Cantidad de resultados visibles, para el aviso en vivo. */
  resultados,
  /** Palabra del contador: "jugadores", "usuarios", "partidos". */
  sustantivo = 'resultados',
  onLimpiar,
  className,
  testId,
}) {
  const filtrando = String(value || '').trim().length > 0;

  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
        />
        <Input
          id={id}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          data-testid={testId}
          className={cn(
            'h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm placeholder:text-slate-600',
            'focus:border-turf focus-visible:ring-2 focus-visible:ring-turf/30',
            onLimpiar && filtrando && 'pr-12',
          )}
        />
        {onLimpiar && filtrando && (
          <button
            type="button"
            onClick={onLimpiar}
            className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Limpiar la búsqueda</span>
          </button>
        )}
      </div>

      {resultados != null && (
        <p aria-live="polite" className="px-1 text-xs text-slate-600">
          {filtrando ? (
            <>
              <span className="font-semibold tabular-nums text-slate-700">{resultados}</span>{' '}
              {sustantivo} para «{value}»
            </>
          ) : (
            <>
              <span className="font-semibold tabular-nums text-slate-700">{resultados}</span>{' '}
              {sustantivo} en total
            </>
          )}
        </p>
      )}
    </div>
  );
}
