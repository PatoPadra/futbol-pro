import React from 'react';

import { cn } from '@/lib/utils';

/**
 * Chip para el `meta` del PageHeader.
 *
 * Los `Badge` de la app estan pensados para fondo claro (`text-foreground`), y
 * sobre la foto del encabezado quedan practicamente invisibles. Este chip usa
 * `glass-dark` con texto blanco, que es lo que los scrims del PhotoBackdrop
 * estan calibrados para sostener.
 *
 * No es interactivo, asi que no necesita 44px de alto.
 */
export default function HeaderChip({ icono: Icono, children, destacado = false, className }) {
  return (
    <span
      className={cn(
        'glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white',
        destacado && 'ring-1 ring-turf-light/70',
        className,
      )}
    >
      {Icono && <Icono className="h-3.5 w-3.5 text-turf-light" aria-hidden="true" />}
      {children}
    </span>
  );
}
