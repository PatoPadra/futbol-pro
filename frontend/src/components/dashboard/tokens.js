/**
 * Clases compartidas por las piezas del panel.
 *
 * Están acá y no repetidas en cada archivo para que el CTA verde y el anillo de
 * foco de las tarjetas no se desincronicen cuando se toca una sola pieza.
 */

/** CTA principal sobre fondo claro. */
export const PRIMARY_CTA =
  'bg-turf hover:bg-turf-dark text-white focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2';

/**
 * Mismo CTA pero sobre video u oscuro: el anillo verde no se ve contra el scrim,
 * así que el foco pasa a ser blanco (regla 6 de las guías).
 */
export const ON_DARK_CTA =
  'bg-turf hover:bg-turf-dark text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';

/** Envoltorio de tarjeta clickeable: el foco se ve en el borde, no en el texto. */
export const CARD_LINK_FOCUS =
  'block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2';
