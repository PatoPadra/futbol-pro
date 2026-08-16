import React from 'react';

import { cn } from '@/lib/utils';
import { identidadDeEquipo } from './teamIdentity';

/**
 * Escudo del equipo: la inicial dentro de una forma de escudo con vivo blanco.
 *
 * Es la pieza que hace que el equipo se reconozca de un vistazo en la cancha,
 * en el plantel y en el resumen, sin depender de leer "Equipo A" cada vez. Es
 * decorativo (`aria-hidden`): el nombre del equipo siempre va escrito al lado.
 */
const ESCUDO = 'polygon(50% 0%, 100% 14%, 100% 60%, 50% 100%, 0% 60%, 0% 14%)';

const TAMANIOS = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-sm',
  md: 'h-11 w-11 text-lg',
  lg: 'h-14 w-14 text-2xl',
};

export default function TeamCrest({ team, tamanio = 'md', className }) {
  const identidad = identidadDeEquipo(team);

  return (
    <span
      aria-hidden="true"
      className={cn('relative inline-grid shrink-0 place-items-center', TAMANIOS[tamanio] || TAMANIOS.md, className)}
    >
      <span className="absolute inset-0 bg-white" style={{ clipPath: ESCUDO }} />
      <span
        className="absolute inset-[2.5px]"
        style={{ clipPath: ESCUDO, backgroundColor: identidad.color }}
      />
      <span className={cn('relative font-heading font-bold leading-none', identidad.sobreColor)}>
        {identidad.label}
      </span>
    </span>
  );
}
