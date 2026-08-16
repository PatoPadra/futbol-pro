import React from 'react';

import { cn } from '@/lib/utils';
import PhotoBackdrop from '@/components/media/PhotoBackdrop';
import { FOTOS_VACIO } from '@/constants/fotos';

/**
 * Estado vacio con foto de fondo.
 *
 * Un estado vacio es el momento en que la app tiene menos para mostrar y mas
 * para explicar, asi que es justo donde una caja gris con un icono desanima. La
 * foto lo llena sin mentir: el catalogo de estados vacios son canchas sin nadie
 * o con poca gente (`FOTOS_VACIO`), porque un festejo multitudinario detras de
 * un "todavia no hay partidos" se contradice solo.
 *
 * El titulo y el texto son la informacion; la foto es decoracion. Si la imagen
 * no carga, el bloque sigue diciendo exactamente lo mismo.
 */
export default function EmptyState({
  /** Indice del set FOTOS_VACIO. Usa uno distinto en cada pantalla. */
  variante = 0,
  foto,
  /** Icono de lucide, opcional. */
  icono: Icono,
  titulo,
  /** Una o dos lineas: que falta y como se soluciona. */
  descripcion,
  /** Boton o link de accion. */
  accion,
  className,
  testId,
}) {
  const elegida = foto || FOTOS_VACIO[variante % FOTOS_VACIO.length];

  return (
    <PhotoBackdrop
      foto={elegida}
      scrim="vacio"
      className={cn('rounded-3xl border border-slate-800/50', className)}
      data-testid={testId}
    >
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center md:py-16">
        {Icono && (
          <span
            aria-hidden="true"
            className="glass-dark mb-1 grid h-14 w-14 place-items-center rounded-2xl"
          >
            <Icono className="h-7 w-7 text-turf-light" />
          </span>
        )}
        <h3 className="font-heading text-2xl font-bold uppercase tracking-tight text-white">
          {titulo}
        </h3>
        {descripcion && (
          <p className="max-w-md text-sm leading-relaxed text-white/85">{descripcion}</p>
        )}
        {accion && <div className="mt-3">{accion}</div>}
      </div>
    </PhotoBackdrop>
  );
}
