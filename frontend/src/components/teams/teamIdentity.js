import { TEAM_COLORS } from '@/constants/matches';

/**
 * Identidad visual de cada equipo.
 *
 * Los dos equipos no se pueden distinguir solo por un color de texto: en la
 * pantalla de equipos generados hay dos canchas, dos planteles y dos resumenes
 * uno al lado del otro, y sin identidad propia se mezclan. Cada equipo tiene
 * escudo, franja de cabecera y tinta propia.
 *
 * `sobreColor` esta fijado a mano y no es intercambiable: el naranja de marca
 * (#FF6B00) con texto blanco encima da 2.8:1 y no pasa AA, asi que sobre el
 * naranja el texto va oscuro. Sobre el carbon del equipo A va blanco (17:1).
 */
export const TEAM_IDENTITY = {
  A: {
    label: 'A',
    nombre: 'Equipo A',
    color: TEAM_COLORS.A,
    /** Texto que va encima del color pleno del equipo. */
    sobreColor: 'text-white',
    sobreColorSuave: 'text-white/80',
    /** Tinta del equipo sobre fondo claro (pasa 4.5:1). */
    tinta: 'text-slate-900',
    /** Fondo suave para chips y filas. */
    suave: 'bg-slate-900/[0.06]',
    borde: 'border-slate-900/15',
    aro: 'ring-slate-900/20',
    /** Barra plena, para medidores. */
    barra: 'bg-slate-900',
  },
  B: {
    label: 'B',
    nombre: 'Equipo B',
    color: TEAM_COLORS.B,
    sobreColor: 'text-slate-950',
    sobreColorSuave: 'text-slate-950/75',
    tinta: 'text-orange-accessible',
    suave: 'bg-orange/10',
    borde: 'border-orange/25',
    aro: 'ring-orange/30',
    barra: 'bg-orange',
  },
};

/** Identidad de un equipo. Si el label no existe, cae en la del equipo A. */
export function identidadDeEquipo(label) {
  return TEAM_IDENTITY[label] || TEAM_IDENTITY.A;
}
