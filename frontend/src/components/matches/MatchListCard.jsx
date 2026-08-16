import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  MATCH_STATUS_BADGE_CLASS,
  MATCH_STATUS_LABELS,
  MODALITY_LABELS,
} from '@/constants/matches';

const FALLBACK_TONE = 'bg-slate-100 text-slate-600 border-slate-200';

const CARD_LINK_FOCUS =
  'block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2';

/**
 * Tarjeta de partido para la lista.
 *
 * Es deliberadamente el mismo lenguaje visual que `dashboard/MatchCard`: banda
 * superior con el tono del estado, datos con ícono, y barra de titulares al pie.
 * Un partido tiene que verse igual en el panel y en la lista, si no la app se
 * siente hecha de pedazos. Lo único que agrega acá es el grupo, que en la lista
 * general sí importa porque se mezclan partidos de varios grupos.
 */
export default function MatchListCard({ match }) {
  const tone = MATCH_STATUS_BADGE_CLASS[match.status] || FALLBACK_TONE;
  const spotsLeft = match.max_players - match.titular_count;
  const isFull = spotsLeft <= 0;
  const fillPct = match.max_players
    ? Math.min(100, Math.round((match.titular_count / match.max_players) * 100))
    : 0;

  return (
    <Link
      to={`/partidos/${match.id}`}
      data-testid={`match-list-card-${match.id}`}
      className={CARD_LINK_FOCUS}
    >
      <Card className="group h-full overflow-hidden rounded-2xl border-slate-200/80 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lift active:scale-[0.98] motion-reduce:transition-none">
        <div className={`flex items-center justify-between gap-2 border-b px-4 py-2 ${tone}`}>
          <span className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            <span className="truncate font-heading text-xs font-bold uppercase tracking-[0.12em]">
              {MATCH_STATUS_LABELS[match.status] || match.status}
            </span>
          </span>
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {MODALITY_LABELS[match.modality] || `Fútbol ${match.modality}`}
          </span>
        </div>

        <div className="p-4">
          <h3 className="font-heading text-lg font-bold uppercase tracking-tight text-slate-900 transition-colors group-hover:text-turf-accessible motion-reduce:transition-none">
            {match.title}
          </h3>

          {match.group_name && (
            <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
              {match.group_name}
            </p>
          )}

          <div className="mt-3 grid grid-cols-1 gap-1.5 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              {match.date}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              {match.time}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="truncate">{match.location}</span>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <span className={isFull ? 'font-semibold text-slate-900' : 'text-slate-600'}>
                {match.titular_count}/{match.max_players} titulares
              </span>
              {isFull ? (
                <Badge className="ml-auto min-h-0 border-0 bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
                  Completo
                </Badge>
              ) : (
                <span className="ml-auto text-xs text-slate-500">
                  {spotsLeft} {spotsLeft === 1 ? 'lugar libre' : 'lugares libres'}
                </span>
              )}
            </div>
            <div
              aria-hidden="true"
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className={`h-full rounded-full ${isFull ? 'bg-slate-900' : 'bg-turf'}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
