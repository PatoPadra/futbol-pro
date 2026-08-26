import React from 'react';
import { Dumbbell, Trophy } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Cómo rinde el jugador en partidos oficiales contra prácticas.
 *
 * Es de lo más útil que puede mostrar la app y también la forma más fácil de
 * vender ruido como si fuera un dato, así que tiene dos frenos, los dos del lado
 * del backend:
 *
 *   1. Con pocos partidos de un tipo, `comparable` viene en falso y acá no se
 *      muestra ninguna comparación: se muestra cuántos faltan. Eso además
 *      engancha, que es mejor que un número que no significa nada.
 *   2. Cada promedio ya viene encogido hacia el rating general del jugador, así
 *      que una racha de tres partidos no alcanza para mover la aguja.
 *
 * La diferencia de menos de medio punto se lee como "parecido" a propósito. En
 * un grupo de amigos, decirle a alguien que no rinde cuando juega en serio no es
 * una estadística: es una acusación, y más vale que haga falta bastante
 * evidencia para escribirla en pantalla.
 */
const DIFERENCIA_QUE_IMPORTA = 0.5;

const TIPOS = [
  { id: 'oficial', label: 'Oficiales', icono: Trophy, tono: 'text-turf-accessible', barra: 'bg-turf' },
  { id: 'practica', label: 'Prácticas', icono: Dumbbell, tono: 'text-orange-accessible', barra: 'bg-orange' },
];

function Fila({ tipo, datos, maximo }) {
  const Icono = tipo.icono;
  const valor = datos?.rating;
  const ancho = valor != null && maximo > 0 ? Math.max(6, (valor / maximo) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Icono className={cn('h-4 w-4 shrink-0', tipo.tono)} aria-hidden="true" />
          {tipo.label}
        </span>
        <span className="text-xs text-slate-600">
          {valor != null && (
            <span className="mr-2 font-heading text-base font-bold tabular-nums text-slate-900">
              {valor.toFixed(1)}
            </span>
          )}
          {datos?.matches ?? 0} {datos?.matches === 1 ? 'partido' : 'partidos'}
        </span>
      </div>
      {valor != null && (
        <div aria-hidden="true" className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={cn('h-full rounded-full', tipo.barra)} style={{ width: `${ancho}%` }} />
        </div>
      )}
    </div>
  );
}

export default function MatchTypeSplit({ split, esPropio, testId }) {
  if (!split?.types) return null;

  const oficial = split.types.oficial || { matches: 0 };
  const practica = split.types.practica || { matches: 0 };

  // Sin un solo partido de ninguno de los dos tipos no hay nada que contar
  // todavía, ni siquiera cuántos faltan.
  if (!oficial.matches && !practica.matches) return null;

  const maximo = Math.max(oficial.rating || 0, practica.rating || 0, 1);
  const hayPuntajes = oficial.rating != null || practica.rating != null;

  let mensaje;
  if (!split.comparable) {
    const faltan = TIPOS
      .map((tipo) => {
        const datos = split.types[tipo.id] || {};
        return datos.missing ? `${datos.missing} ${datos.missing === 1 ? tipo.label.toLowerCase().replace(/s$/, '') : tipo.label.toLowerCase()}` : null;
      })
      .filter(Boolean);
    mensaje = faltan.length
      ? `${esPropio ? 'Te faltan' : 'Faltan'} ${faltan.join(' y ')} para poder comparar.`
      : 'Todavía no hay suficientes partidos para comparar.';
  } else if (split.gap == null) {
    mensaje = null;
  } else if (Math.abs(split.gap) < DIFERENCIA_QUE_IMPORTA) {
    mensaje = `${esPropio ? 'Rendís' : 'Rinde'} parecido en los dos.`;
  } else if (split.gap > 0) {
    mensaje = `${esPropio ? 'Rendís' : 'Rinde'} mejor cuando el partido es oficial.`;
  } else {
    mensaje = `${esPropio ? 'Rendís' : 'Rinde'} mejor en las prácticas que en los oficiales.`;
  }

  return (
    <section
      className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-lift sm:p-6"
      data-testid={testId || 'match-type-split'}
    >
      <h3 className="font-heading text-base font-bold uppercase tracking-tight text-slate-900">
        Oficiales y prácticas
      </h3>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
        {split.comparable
          ? 'Con suficientes partidos de cada tipo ya se pueden comparar.'
          : `Hacen falta al menos ${split.min_matches} de cada tipo para que la comparación signifique algo.`}
      </p>

      <div className="mt-4 space-y-4">
        {TIPOS.map((tipo) => (
          <Fila key={tipo.id} tipo={tipo} datos={split.types[tipo.id]} maximo={maximo} />
        ))}
      </div>

      {mensaje && (
        <p
          className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-relaxed text-slate-700"
          data-testid="split-message"
        >
          {mensaje}
        </p>
      )}

      {split.comparable && hayPuntajes && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
          Los dos números están ajustados contra el rating general: una racha
          corta no alcanza para moverlos.
        </p>
      )}
    </section>
  );
}
