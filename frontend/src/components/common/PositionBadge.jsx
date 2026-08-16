import React from 'react';
import { cn } from '@/lib/utils';

// Line-of-play color coding (inspired by Transfermarkt-style position tags):
// goalkeeper / defense / midfield / attack each get a distinct, on-palette
// color instead of the position code being rendered as plain text. Position
// values are the short ids from backend/constants.py POSITIONS (GK, RB, CB,
// LB, CDM, RM, LM, CAM, RW, LW, ST) or the generic "JUG" fallback.
const LINE_BY_ID = {
  GK: 'gk',
  RB: 'def', CB: 'def', LB: 'def',
  CDM: 'mid', RM: 'mid', LM: 'mid', CAM: 'mid',
  RW: 'att', LW: 'att', ST: 'att',
};

const LINE_CLASSES = {
  gk: 'bg-secondary/10 text-secondary border-secondary/20',
  def: 'bg-slate-100 text-slate-600 border-slate-200',
  mid: 'bg-turf/15 text-turf-accessible border-turf/30',
  att: 'bg-orange/15 text-orange-accessible border-orange/30',
  neutral: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function PositionBadge({ positionId, className }) {
  if (!positionId) return null;
  const line = LINE_BY_ID[positionId] || 'neutral';
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        LINE_CLASSES[line],
        className
      )}
    >
      {positionId}
    </span>
  );
}
