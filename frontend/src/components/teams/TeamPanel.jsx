import React from 'react';

import { cn } from '@/lib/utils';
import TeamCrest from './TeamCrest';
import { identidadDeEquipo } from './teamIdentity';

/**
 * Panel de un equipo: franja de cabecera con el color del equipo, escudo,
 * nombre y contador; abajo el cuerpo claro con lo que sea (plantel, resumen,
 * cancha).
 *
 * La cabecera lleva las rayas de corte (`bg-pitch-stripes`) para que el bloque
 * se lea como cancha y no como un titulo con color de fondo.
 */
export default function TeamPanel({
  team,
  /** Linea chica arriba a la izquierda, dentro de la franja. */
  subtitulo,
  /** Numero grande a la derecha (cantidad de jugadores, por ejemplo). */
  cantidad,
  /** Etiqueta accesible del contador: sin esto un numero solo no dice nada. */
  cantidadLabel,
  /** Chips o botones extra dentro de la franja. */
  acciones,
  /** Si es false, el cuerpo va sin padding (para meter una cancha a sangre). */
  padding = true,
  children,
  className,
  testId,
}) {
  const identidad = identidadDeEquipo(team);

  return (
    <section
      className={cn('overflow-hidden rounded-3xl border bg-white shadow-lift', identidad.borde, className)}
      data-testid={testId}
    >
      <header className="relative overflow-hidden px-4 py-3" style={{ backgroundColor: identidad.color }}>
        <span aria-hidden="true" className="absolute inset-0 bg-pitch-stripes" />
        <div className="relative flex items-center gap-3">
          <TeamCrest team={team} tamanio="sm" />
          <div className="min-w-0 flex-1">
            <p className={cn('font-heading text-xl font-bold uppercase leading-none tracking-tight', identidad.sobreColor)}>
              {identidad.nombre}
            </p>
            {subtitulo && (
              <p className={cn('mt-1 text-[11px] font-semibold uppercase tracking-wider', identidad.sobreColorSuave)}>
                {subtitulo}
              </p>
            )}
          </div>
          {cantidad != null && (
            <span className={cn('rounded-full bg-white px-2.5 py-1 font-heading text-base font-bold leading-none', identidad.tinta)}>
              {cantidad}
              {cantidadLabel && <span className="sr-only"> {cantidadLabel}</span>}
            </span>
          )}
          {acciones}
        </div>
      </header>
      <div className={padding ? 'p-4' : undefined}>{children}</div>
    </section>
  );
}
