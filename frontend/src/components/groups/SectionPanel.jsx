import React from 'react';

import { cn } from '@/lib/utils';

/**
 * Panel de seccion: la unidad de agrupamiento de las pantallas de grupos.
 *
 * Existe para que el contenido deje de ser una pared de listas sueltas sobre
 * blanco. Cada bloque arranca con un encabezado propio (icono en chip + titulo
 * + una linea de contexto), y el panel se apoya con borde y `shadow-lift` para
 * que se lea como una pieza y no como parte del fondo.
 *
 * `tono`:
 *   'claro'  panel blanco, el default
 *   'mesh'   fondo con la malla verde de marca, para el bloque que queremos
 *            que se lea como "nuestro" (el formulario de sumar gente)
 *   'riesgo' rojo apagado, para acciones destructivas
 */
const TONOS = {
  claro: 'border-slate-200 bg-white',
  // bg-mesh-turf es solo background-image: sin una base blanca el panel deja
  // ver el fondo de la pagina y la malla pierde el contraste.
  mesh: 'border-turf/20 bg-white bg-mesh-turf',
  riesgo: 'border-red-200 bg-red-50/70',
};

const CHIPS = {
  claro: 'bg-turf/10 text-turf-accessible',
  mesh: 'bg-white text-turf-accessible shadow-sm',
  riesgo: 'bg-red-100 text-red-700',
};

export default function SectionPanel({
  icono: Icono,
  titulo,
  descripcion,
  /** Contenido chico a la derecha del titulo: contador, filtro, badge. */
  aside,
  tono = 'claro',
  className,
  contentClassName,
  children,
  testId,
}) {
  return (
    <section
      className={cn('rounded-3xl border shadow-lift', TONOS[tono] || TONOS.claro, className)}
      data-testid={testId}
    >
      {(titulo || aside) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-900/5 px-5 py-4 md:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {Icono && (
              <span
                aria-hidden="true"
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                  CHIPS[tono] || CHIPS.claro,
                )}
              >
                <Icono className="h-[18px] w-[18px]" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="font-heading text-base font-bold uppercase leading-tight tracking-tight text-slate-900 md:text-lg">
                {titulo}
              </h2>
              {descripcion && (
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-600">
                  {descripcion}
                </p>
              )}
            </div>
          </div>

          {aside && <div className="shrink-0">{aside}</div>}
        </header>
      )}

      <div className={cn('px-5 py-5 md:px-6', contentClassName)}>{children}</div>
    </section>
  );
}
