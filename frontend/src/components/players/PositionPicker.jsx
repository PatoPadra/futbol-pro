import React from 'react';
import { Check, X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Selector de posiciones agrupado por línea de la cancha.
 *
 * Antes eran chips sueltos en el orden crudo del backend: una fila larga donde
 * "arquero" y "delantero" se veían igual y había que leer cada texto. Acá las
 * opciones se agrupan por línea (arco, defensa, medio, ataque) y cada botón
 * muestra la sigla en un cuadrado más el nombre completo, así se elige mirando
 * en lugar de leyendo.
 *
 * Es sólo presentación: recibe las opciones ya filtradas por la página, no
 * decide nada y llama a `onToggle(id)` con el mismo handler de antes. Toda
 * opción que no esté en el mapa de líneas cae en el grupo "Otras", para que
 * nunca desaparezca una posición si el backend agrega ids nuevos.
 */
const LINEA_POR_ID = {
  GK: 'arco',
  RB: 'defensa', CB: 'defensa', LB: 'defensa',
  CDM: 'medio', RM: 'medio', LM: 'medio', CAM: 'medio',
  RW: 'ataque', LW: 'ataque', ST: 'ataque',
};

const LINEAS = [
  { key: 'arco', label: 'Arco' },
  { key: 'defensa', label: 'Defensa' },
  { key: 'medio', label: 'Medio' },
  { key: 'ataque', label: 'Ataque' },
  { key: 'otras', label: 'Otras' },
];

/** Tonos del estado seleccionado. El no seleccionado es siempre el mismo. */
const TONOS = {
  turf: {
    on: 'border-turf bg-turf-btn text-white shadow-lift-turf',
    onSigla: 'bg-white/20 text-white',
    ring: 'focus-visible:ring-turf',
    hover: 'hover:border-turf/60 hover:bg-turf/5',
  },
  charcoal: {
    on: 'border-slate-800 bg-slate-800 text-white shadow-lift',
    onSigla: 'bg-white/20 text-white',
    ring: 'focus-visible:ring-slate-700',
    hover: 'hover:border-slate-400 hover:bg-slate-50',
  },
  danger: {
    on: 'border-rose-600 bg-rose-600 text-white shadow-lift',
    onSigla: 'bg-white/20 text-white',
    ring: 'focus-visible:ring-rose-600',
    hover: 'hover:border-rose-300 hover:bg-rose-50',
  },
};

export default function PositionPicker({
  /** Opciones ya filtradas: [{ id, name }]. */
  opciones = [],
  /** Id seleccionado (single) o array de ids (multi). */
  seleccion,
  /** Prefijo del data-testid de cada botón: `${testIdPrefix}-${id}`. */
  testIdPrefix,
  onToggle,
  disabled = false,
  tono = 'turf',
  /** 'check' | 'cruz' | 'none': la marca del estado elegido. */
  marca = 'check',
  /** Texto del `role="group"`. */
  ariaLabel,
  className,
}) {
  const elegidos = Array.isArray(seleccion) ? seleccion : (seleccion ? [seleccion] : []);
  const t = TONOS[tono] || TONOS.turf;
  const Marca = marca === 'cruz' ? X : Check;

  const grupos = LINEAS
    .map((linea) => ({
      ...linea,
      items: opciones.filter((p) => (LINEA_POR_ID[p.id] || 'otras') === linea.key),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className={cn('space-y-3', className)} role="group" aria-label={ariaLabel}>
      {grupos.map((grupo) => (
        <div key={grupo.key}>
          {grupos.length > 1 && (
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
              {grupo.label}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {grupo.items.map((p) => {
              const activo = elegidos.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`${testIdPrefix}-${p.id}`}
                  aria-pressed={activo}
                  disabled={disabled}
                  onClick={() => onToggle(p.id)}
                  className={cn(
                    'group inline-flex min-h-[48px] items-center gap-2 rounded-2xl border bg-white pl-1.5 pr-3.5 text-left text-sm font-semibold text-slate-700',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    t.ring,
                    activo ? t.on : cn('border-slate-200', t.hover),
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-xl font-heading text-[13px] font-bold uppercase leading-none tabular-nums',
                      activo ? t.onSigla : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {p.id}
                  </span>
                  <span className="leading-tight">{p.name}</span>
                  {activo && marca !== 'none' && (
                    <Marca className="ml-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
