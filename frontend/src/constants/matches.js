export const MATCH_STATUSES_ACTIVE = ['abierto', 'cerrado', 'equipos_generados', 'equipos_confirmados'];
export const MATCH_STATUSES_PAST = ['finalizado', 'completado'];

export const MODALITY_LABELS = {
  5: 'Futbol 5',
  6: 'Futbol 6',
  7: 'Futbol 7',
  8: 'Futbol 8',
  9: 'Futbol 9',
  10: 'Futbol 10',
  11: 'Futbol 11',
};

export const MODALITY_SHORT_LABELS = {
  5: 'F5',
  6: 'F6',
  7: 'F7',
  8: 'F8',
  9: 'F9',
  10: 'F10',
  11: 'F11',
};

export const MATCH_STATUS_LABELS = {
  abierto: 'Abierto',
  cerrado: 'Cerrado',
  equipos_generados: 'Equipos generados',
  equipos_confirmados: 'Equipos confirmados',
  finalizado: 'Finalizado',
  completado: 'Completado',
};

export const MATCH_STATUS_SHORT_LABELS = {
  ...MATCH_STATUS_LABELS,
  equipos_generados: 'Equipos',
  equipos_confirmados: 'Confirmado',
};

export const MATCH_STATUS_STYLES = {
  abierto: 'bg-turf/10 text-turf border-turf/20',
  cerrado: 'bg-orange/10 text-orange border-orange/20',
  equipos_generados: 'bg-blue-50 text-blue-600 border-blue-200',
  equipos_confirmados: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  finalizado: 'bg-slate-100 text-slate-600 border-slate-200',
  completado: 'bg-slate-50 text-slate-400 border-slate-200',
};

export function getModalityLabel(modality, { short = false } = {}) {
  const labels = short ? MODALITY_SHORT_LABELS : MODALITY_LABELS;
  return labels[modality] || (short ? `F${modality}` : `Futbol ${modality}`);
}

export function getMatchStatusLabel(status, { short = false } = {}) {
  const labels = short ? MATCH_STATUS_SHORT_LABELS : MATCH_STATUS_LABELS;
  return labels[status] || status;
}

export function getMatchStatusStyle(status) {
  return MATCH_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 border-slate-200';
}

export function isActiveMatchStatus(status) {
  return MATCH_STATUSES_ACTIVE.includes(status);
}

export function isPastMatchStatus(status) {
  return MATCH_STATUSES_PAST.includes(status);
}
