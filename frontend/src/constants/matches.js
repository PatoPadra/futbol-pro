// Single source of truth for the two generated-team colors — previously
// repeated as raw hex literals in both GeneratedTeams.js and FootballPitch.js.
export const TEAM_COLORS = { A: '#1A1D23', B: '#FF6B00' };

export const MODALITY_LABELS = {
  5: 'Futbol 5',
  6: 'Futbol 6',
  7: 'Futbol 7',
  8: 'Futbol 8',
  9: 'Futbol 9',
  10: 'Futbol 10',
  11: 'Futbol 11',
};

export const MATCH_STATUS_LABELS = {
  abierto: 'Abierto',
  cerrado: 'Cerrado',
  equipos_generados: 'Equipos Generados',
  equipos_confirmados: 'Equipos Confirmados',
  finalizado: 'Finalizado',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

// All tones below use brand tokens (turf/orange/secondary) or the neutral
// slate scale already used for text.secondary/disabled in design_guidelines.json.
// equipos_generados/equipos_confirmados previously used blue/indigo, which
// don't exist anywhere in the documented palette.
export const MATCH_STATUS_BADGE_CLASS = {
  abierto: 'bg-turf/10 text-turf-accessible border-turf/20',
  cerrado: 'bg-amber-50 text-amber-700 border-amber-200',
  equipos_generados: 'bg-orange/10 text-orange border-orange/20',
  equipos_confirmados: 'bg-secondary/10 text-secondary border-secondary/20',
  finalizado: 'bg-slate-100 text-slate-700 border-slate-200',
  completado: 'bg-slate-50 text-slate-500 border-slate-200',
  cancelado: 'bg-red-50 text-red-700 border-red-200',
};

// Same hue family as MATCH_STATUS_BADGE_CLASS, as a solid left-border accent
// for list rows (badges alone get missed when scanning a long list fast).
export const MATCH_STATUS_ACCENT_BORDER = {
  abierto: 'border-l-turf',
  cerrado: 'border-l-amber-400',
  equipos_generados: 'border-l-orange',
  equipos_confirmados: 'border-l-secondary',
  finalizado: 'border-l-slate-300',
  completado: 'border-l-slate-200',
  cancelado: 'border-l-red-400',
};
