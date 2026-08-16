import React from 'react';

import { cn } from '@/lib/utils';

/**
 * Chip para el `meta` del PageHeader del flujo de partido.
 *
 * El `Badge` de shadcn está calibrado para fondo claro (sus tonos usan
 * `text-turf-accessible` y compañía, que sobre una foto oscura desaparecen).
 * Acá el fondo es el scrim "banda" de PhotoBackdrop, así que el texto es blanco
 * y el relleno es un velo translúcido: queda arriba de 4.5:1 en todo el rango
 * del scrim.
 *
 * El color nunca es la única señal: el chip de estado lleva el texto del estado
 * escrito y, cuando `punto` está prendido, además un punto lleno. Un daltónico
 * lee "Cerrado" igual que cualquiera.
 */
const TONOS = {
  neutro: 'bg-white/[0.14] ring-white/25',
  turf: 'bg-turf-dark/70 ring-turf-light/60',
  orange: 'bg-orange/40 ring-orange-light/70',
  alerta: 'bg-red-900/70 ring-red-300/60',
  apagado: 'bg-slate-900/60 ring-white/20',
};

export default function MetaChip({
  icono: Icono,
  tono = 'neutro',
  /** Punto lleno adelante: para el chip de estado. */
  punto = false,
  className,
  children,
  ...rest
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white ring-1 backdrop-blur-sm',
        TONOS[tono] || TONOS.neutro,
        className,
      )}
      {...rest}
    >
      {punto && (
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      )}
      {Icono && <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </span>
  );
}
