// Single source of truth for "1-10 performance rating -> color/label".
// Previously reimplemented independently as scoreTone() in PostMatch.js and
// ratingTier() in both PlayerProfile.js and PlayerHistory.js, each with
// slightly different breakpoints — they were already drifting apart.
export function getRatingTone(value) {
  if (value == null) {
    return {
      key: 'none',
      text: 'text-slate-400',
      bg: 'bg-slate-100',
      ring: 'ring-slate-200',
      border: 'border-slate-200',
      solid: 'bg-slate-400',
      label: 'Sin datos',
    };
  }
  if (value < 4) {
    return {
      key: 'low',
      text: 'text-rose-600',
      bg: 'bg-rose-50',
      ring: 'ring-rose-200',
      border: 'border-rose-200',
      solid: 'bg-rose-500',
      label: 'A mejorar',
    };
  }
  if (value < 6) {
    return {
      key: 'mid',
      text: 'text-slate-700',
      bg: 'bg-slate-100',
      ring: 'ring-slate-300',
      border: 'border-slate-200',
      solid: 'bg-slate-500',
      label: 'Promedio',
    };
  }
  if (value < 8) {
    return {
      key: 'good',
      text: 'text-turf-accessible',
      bg: 'bg-turf/10',
      ring: 'ring-turf/20',
      border: 'border-turf/20',
      solid: 'bg-turf',
      label: 'Bueno',
    };
  }
  return {
    key: 'great',
    text: 'text-turf-accessible',
    bg: 'bg-turf/15',
    ring: 'ring-turf/40',
    border: 'border-turf/30',
    solid: 'bg-turf-dark',
    label: 'Muy bueno',
  };
}
