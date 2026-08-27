import React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Lista de opciones como tarjetas seleccionables.
 *
 * Es un radio group, no un `<select>`, y eso es a propósito: elegir el modo de un
 * partido no es elegir un ítem de una lista, es entender qué le va a pedir la app
 * al grupo después de jugar. Un desplegable esconde justo eso — la descripción de
 * cada opción — atrás de un click, y quien no sabe qué elegir se queda con el
 * primero que aparece.
 *
 * Va con `role="radiogroup"` y botones y no con `<input type=radio>` porque la
 * tarjeta entera es el área clickeable (en el celular es la diferencia entre
 * pegarle y no pegarle). Las flechas del teclado no se reimplementan: cada
 * tarjeta es tabulable, que es el comportamiento que la gente espera de un grupo
 * de botones.
 */
export default function OptionCards({
  options = [],
  value,
  onChange,
  /** 1 = una debajo de otra (default). 2 = dos por fila desde sm. */
  columns = 1,
  disabled = false,
  name,
  testId,
}) {
  if (!options.length) return null;

  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn('grid gap-2.5', columns === 2 && 'sm:grid-cols-2')}
      data-testid={testId}
    >
      {options.map((option) => {
        const elegida = option.id === value;
        // Una opcion que existe en el catalogo pero todavia no tiene sus
        // pantallas se muestra igual, apagada y con la etiqueta. Esconderla
        // haria que la app prometa cinco modos y muestre cuatro sin explicar
        // por que; ofrecerla como si anduviera seria peor.
        const disponible = option.available !== false;
        const bloqueada = disabled || !disponible;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={elegida}
            disabled={bloqueada}
            onClick={() => onChange?.(option.id)}
            data-testid={`${testId || 'option'}-${option.id}`}
            className={cn(
              'flex w-full items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2',
              'motion-reduce:transition-none',
              elegida
                ? 'border-turf bg-turf/5 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80',
              bloqueada && 'cursor-not-allowed opacity-60',
              !disponible && 'hover:border-slate-200 hover:bg-white',
            )}
          >
            {/* El tilde en un círculo y no sólo el borde de color: el color por sí
                solo no alcanza para saber cuál está elegida. */}
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors motion-reduce:transition-none',
                elegida ? 'border-turf bg-turf-btn text-white' : 'border-slate-300 bg-white',
              )}
            >
              {elegida && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>

            <span className="min-w-0">
              <span
                className={cn(
                  'flex flex-wrap items-center gap-2 font-heading text-sm font-bold uppercase tracking-tight',
                  elegida ? 'text-turf-accessible' : 'text-slate-900',
                )}
              >
                {option.name}
                {!disponible && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    Próximamente
                  </span>
                )}
              </span>
              {option.description && (
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                  {option.description}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
