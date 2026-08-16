import React from 'react';
import {
  Ban,
  CheckCheck,
  CircleDot,
  Flag,
  Lock,
  Shield,
  Shuffle,
  Trophy,
  User,
  UserCog,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { MATCH_STATUS_BADGE_CLASS, MATCH_STATUS_LABELS } from '@/constants/matches';

/**
 * Chips de estado y de rol para las tablas de los paneles.
 *
 * Lo importante aca no es el color: es que cada estado tenga TAMBIEN una forma.
 * Siete estados de partido en siete tonos de badge son indistinguibles para
 * quien no separa rojo de verde, y ademas obligan a todo el mundo a leer el
 * texto de cada fila para escanear una lista. Con un glifo distinto por estado
 * la lista se lee de un saque.
 *
 * Los colores salen de `MATCH_STATUS_BADGE_CLASS` (fuente unica, no los
 * redefinimos aca) y el glifo es el unico agregado.
 *
 * Son etiquetas, no botones: van como `span` sin alto minimo de 44px, para que
 * las filas de tabla queden densas de verdad.
 */
const ICONO_ESTADO = {
  abierto: CircleDot,
  cerrado: Lock,
  equipos_generados: Shuffle,
  equipos_confirmados: CheckCheck,
  finalizado: Flag,
  completado: Trophy,
  cancelado: Ban,
};

const BASE_CHIP =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-tight';

export function EstadoChip({ status, className }) {
  const Icono = ICONO_ESTADO[status];
  const tono = MATCH_STATUS_BADGE_CLASS[status] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={cn(BASE_CHIP, tono, className)}>
      {Icono && <Icono className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {MATCH_STATUS_LABELS[status] || status}
    </span>
  );
}

const ROL = {
  admin: { label: 'Admin', icono: Shield, tono: 'bg-secondary text-secondary-foreground border-transparent' },
  organizador: { label: 'Organizador', icono: UserCog, tono: 'bg-turf/10 text-turf-accessible border-turf/25' },
  jugador: { label: 'Jugador', icono: User, tono: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export function RolChip({ role, className }) {
  const cfg = ROL[role];
  if (!cfg) {
    return <span className={cn(BASE_CHIP, ROL.jugador.tono, className)}>{role}</span>;
  }
  const Icono = cfg.icono;

  return (
    <span className={cn(BASE_CHIP, cfg.tono, className)}>
      <Icono className="h-3 w-3 shrink-0" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

/** Chip neutro para metadatos (modalidad, tipo de jugador, permiso de grupo). */
export function MetaChip({ icono: Icono, children, tono, className }) {
  return (
    <span className={cn(BASE_CHIP, tono || 'border-slate-200 bg-slate-50 text-slate-600', className)}>
      {Icono && <Icono className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}
