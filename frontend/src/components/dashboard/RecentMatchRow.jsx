import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronRight, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  MATCH_STATUS_ACCENT_BORDER,
  MATCH_STATUS_BADGE_CLASS,
  MATCH_STATUS_LABELS,
  MODALITY_LABELS,
} from '@/constants/matches';
import { CARD_LINK_FOCUS } from './tokens';

const FALLBACK_TONE = 'bg-slate-100 text-slate-600 border-slate-200';

/**
 * Fila de partido jugado. Mantiene la lectura de lista (rápida de escanear) pero
 * con el acento de estado a la izquierda, el ícono en el tono del estado y una
 * flecha que se corre en hover para que se lea como clickeable.
 */
export default function RecentMatchRow({ match }) {
  const tone = MATCH_STATUS_BADGE_CLASS[match.status] || FALLBACK_TONE;
  const accent = MATCH_STATUS_ACCENT_BORDER[match.status] || 'border-l-slate-200';

  return (
    <Link to={`/partidos/${match.id}`} data-testid={`recent-match-${match.id}`} className={CARD_LINK_FOCUS}>
      <div
        className={`group flex items-center gap-3 rounded-2xl border border-l-4 border-slate-200/70 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98] motion-reduce:transition-none ${accent}`}
      >
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
          <Trophy className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{match.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
            {match.date} - {MODALITY_LABELS[match.modality]}
          </p>
        </div>

        <Badge className={`min-h-0 shrink-0 border px-2 py-0.5 text-[11px] ${tone}`}>
          {MATCH_STATUS_LABELS[match.status] || match.status}
        </Badge>
        <ChevronRight
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-turf-accessible motion-reduce:transition-none"
        />
      </div>
    </Link>
  );
}
