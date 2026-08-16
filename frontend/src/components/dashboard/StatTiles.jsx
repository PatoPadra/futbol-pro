import React from 'react';
import { Star, Target, Trophy, Users } from 'lucide-react';

/**
 * Identidad visual por métrica. Van sobre base oscura a propósito: el número
 * blanco sobre #0F172A pasa contraste con margen (y de paso corta la fila de
 * tarjetas blancas que era el problema original).
 *
 * `wash` es el degradado propio, `glow` la mancha de color desenfocada, `bar` la
 * línea superior y `mark` el ícono de marca de agua.
 */
const TONES = {
  partidos: {
    icon: Trophy,
    wash: 'from-turf-dark/70 via-slate-900 to-slate-900',
    glow: 'bg-turf/40',
    bar: 'bg-turf',
    mark: 'text-turf/20',
  },
  rating: {
    icon: Star,
    wash: 'from-pitch/70 via-slate-900 to-slate-900',
    glow: 'bg-turf-light/35',
    bar: 'bg-turf-light',
    mark: 'text-turf-light/20',
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
};

/**
 * Fila de métricas del jugador.
 *
 * El tile de Rating sólo existe si el backend habilita `can_view_peer_scores`:
 * los puntajes entre pares no son públicos.
 */
export default function StatTiles({ metrics }) {
  const tiles = [
    { label: 'Partidos', value: metrics.total_matches ?? 0 },
    ...(metrics.can_view_peer_scores
      ? [{ label: 'Rating', value: metrics.recent_rating?.toFixed(1) || '-' }]
      : []),
    { label: 'Goles', value: metrics.total_goals ?? 0 },
    { label: 'Asistencias', value: metrics.total_assists ?? 0 },
  ];

  return (
    <>
      <div
        className={`grid grid-cols-2 gap-3 ${tiles.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}
      >
        {tiles.map((tile) => {
          const key = tile.label.toLowerCase();
          const tone = TONES[key] || TONES.partidos;
          const Icon = tone.icon;

          return (
            <div
              key={key}
              data-testid={`dashboard-stat-${key}`}
              className="noise relative overflow-hidden rounded-2xl bg-slate-900 p-4 pt-5 shadow-lift ring-1 ring-white/10 transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none"
            >
              <div
                aria-hidden="true"
                className={`absolute inset-0 bg-gradient-to-br ${tone.wash}`}
              />
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

      {!metrics.can_view_peer_scores && (
        <p className="mt-3 text-xs text-slate-500">
          Los puntajes internos quedan visibles solo para organizadores y admins.
        </p>
      )}
    </>
  );
}
