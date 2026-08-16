import React from 'react';
import { Hand, Target, Trophy, Users } from 'lucide-react';

/**
 * Fila de métricas de un jugador.
 *
 * Mismo lenguaje visual que `components/dashboard/StatTiles`: base oscura,
 * degradado propio por métrica, número grande en `font-heading` y el ícono como
 * marca de agua. Está acá y no reutiliza esa pieza porque la del panel arma sus
 * propios tiles a partir del objeto `metrics` (y decide sola si muestra Rating);
 * el perfil y el historial ya traen la lista armada, incluyendo Atajadas.
 *
 * Cada tile conserva `data-testid="stat-tile"`, que es el contrato que tenían
 * estas dos pantallas cuando usaban `common/StatTile`.
 */
const TONES = {
  partidos: {
    icon: Trophy,
    wash: 'from-turf-dark/70 via-slate-900 to-slate-900',
    glow: 'bg-turf/40',
    bar: 'bg-turf',
    mark: 'text-turf/20',
  },
  goles: {
    icon: Target,
    wash: 'from-orange/50 via-slate-900 to-slate-900',
    glow: 'bg-orange/40',
    bar: 'bg-orange',
    mark: 'text-orange/25',
  },
  asistencias: {
    icon: Users,
    wash: 'from-orange-light/40 via-slate-900 to-slate-900',
    glow: 'bg-orange-light/30',
    bar: 'bg-orange-light',
    mark: 'text-orange-light/25',
  },
  atajadas: {
    icon: Hand,
    wash: 'from-pitch-dark/80 via-slate-900 to-slate-900',
    glow: 'bg-turf-light/25',
    bar: 'bg-pitch',
    mark: 'text-turf-light/20',
  },
};

export default function MetricTiles({ tiles, testId, className = '' }) {
  const cols = tiles.length >= 4 ? 'md:grid-cols-4' : 'md:grid-cols-3';

  return (
    <div className={`grid grid-cols-2 gap-3 ${cols} ${className}`} data-testid={testId}>
      {tiles.map((tile) => {
        const key = String(tile.label).toLowerCase();
        const tone = TONES[key] || TONES.partidos;
        const Icon = tone.icon;

        return (
          <div
            key={key}
            data-testid="stat-tile"
            className="noise relative overflow-hidden rounded-2xl bg-slate-900 p-4 pt-5 shadow-lift ring-1 ring-white/10 transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none"
          >
            <div aria-hidden="true" className={`absolute inset-0 bg-gradient-to-br ${tone.wash}`} />
            <span
              aria-hidden="true"
              className={`absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl ${tone.glow}`}
            />
            <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${tone.bar}`} />
            <Icon
              aria-hidden="true"
              className={`pointer-events-none absolute -bottom-4 -right-3 h-20 w-20 ${tone.mark}`}
            />

            <div className="relative">
              <p className="font-heading text-3xl font-bold leading-none tabular-nums text-white md:text-4xl">
                {tile.value}
              </p>
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70 md:text-[11px]">
                {tile.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
