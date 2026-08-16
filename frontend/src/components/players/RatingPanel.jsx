import React from 'react';
import { Gauge, Star, TrendingUp } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { getRatingTone } from '@/utils/ratings';

/**
 * Resumen de rating: general, reciente y confianza.
 *
 * Vivía duplicado en PlayerProfile y PlayerHistory con el mismo markup, así que
 * acá queda una sola vez. Sigue siendo puro presentacional: los valores, el
 * cálculo de confianza y el permiso para mostrarlo los decide la página.
 *
 * La confianza se muestra con número y con barra, no sólo con color: el estado
 * "recién te conocemos" tiene que leerse también en escala de grises.
 */
export default function RatingPanel({ metrics, confidence, testId, className = '' }) {
  const general = getRatingTone(metrics.general_rating);
  const reciente = getRatingTone(metrics.recent_rating);

  return (
    <Card
      className={`overflow-hidden rounded-3xl border-slate-100 bg-mesh-turf shadow-lift ${className}`}
      data-testid={testId}
    >
      <CardContent className="p-5">
        <div className="grid grid-cols-2 gap-3">
          <RatingCelda
            tone={general}
            valor={metrics.general_rating}
            etiqueta="Rating general"
            detalle="Todos tus partidos"
          />
          <RatingCelda
            tone={reciente}
            valor={metrics.recent_rating}
            etiqueta="Rating reciente"
            detalle="Tu último tramo"
          />
        </div>

        <div className="mt-5 border-t border-slate-200/70 pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
              <span
                aria-hidden="true"
                className="grid h-6 w-6 place-items-center rounded-lg bg-white/70 text-turf-accessible"
              >
                <Gauge className="h-3.5 w-3.5" />
              </span>
              Confianza del rating
            </span>
            <span
              className="font-heading text-lg font-bold leading-none tabular-nums text-slate-900"
              data-testid="confidence-index-value"
            >
              {confidence.pct}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white ring-1 ring-inset ring-slate-200">
            <div
              className={`h-full rounded-full [transition-duration:700ms] transition-[width] motion-reduce:transition-none ${confidence.bar}`}
              style={{ width: `${confidence.pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{confidence.msg}</p>

          {metrics.stats_bonus > 0 && (
            <div
              className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-orange/10 px-3 py-1.5 text-xs font-semibold text-orange-accessible ring-1 ring-orange/25"
              data-testid="stats-bonus-chip"
            >
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              Bono de +{metrics.stats_bonus.toFixed(1)} por tu buen rendimiento reciente
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RatingCelda({ tone, valor, etiqueta, detalle }) {
  return (
    <div className="rounded-2xl bg-white/75 p-4 text-center ring-1 ring-inset ring-white">
      <div className={`inline-flex items-baseline gap-1.5 ${tone.text}`}>
        <Star className="h-5 w-5 shrink-0 translate-y-0.5 fill-current" aria-hidden="true" />
        <span className="font-heading text-4xl font-bold leading-none tabular-nums">
          {valor != null ? Number(valor).toFixed(1) : '—'}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
        {etiqueta}
      </p>
      <p className="text-[11px] text-slate-500">{detalle}</p>
    </div>
  );
}
