/**
 * Catálogo de formatos y estados de torneo, para la UI.
 *
 * La lista canónica vive en el backend (`constants.py`). Ésta es la copia que
 * usa el frontend para pintar el selector de formato sin esperar un round-trip,
 * más los textos que sólo existen en pantalla (la explicación de cada formato,
 * el color del chip de estado).
 */

export const FORMATOS = [
  {
    id: 'liga',
    label: 'Liga',
    resumen: 'Todos contra todos',
    detalle:
      'Una rueda: cada equipo juega contra todos los demás. Gana el que más puntos suma. Es el formato más simple y el que menos partidos deja al azar.',
    // Lo que se necesita saber ANTES de elegir, no después: cuántos partidos
    // salen. Con 6 equipos una liga son 15 partidos y eso sorprende a mucha gente.
    partidos: (n) => (n * (n - 1)) / 2,
  },
  {
    id: 'zonas_eliminatoria',
    label: 'Zonas + eliminatoria',
    resumen: 'Fase de grupos y después llaves',
    detalle:
      'Los equipos se reparten en zonas, juegan todos contra todos adentro de su zona, y los mejores de cada una pasan a las llaves de eliminación directa.',
    partidos: null, // depende de cuántas zonas y cuántos clasifican
  },
  {
    id: 'eliminacion',
    label: 'Eliminación directa',
    resumen: 'El que pierde, afuera',
    detalle:
      'Llaves tipo copa. Si la cantidad de equipos no es potencia de dos, los mejores sembrados pasan de largo la primera ronda.',
    partidos: (n) => Math.max(0, n - 1),
  },
];

export const FORMATO_IDS = FORMATOS.map((f) => f.id);

const FORMATO_POR_ID = new Map(FORMATOS.map((f) => [f.id, f]));

export function formatoDe(id) {
  return FORMATO_POR_ID.get(id) || null;
}

/**
 * Estados del torneo. El color no es la única señal: cada chip lleva su texto
 * completo, que es lo que de verdad distingue "en zonas" de "en llaves".
 */
export const ESTADOS = {
  borrador: {
    label: 'Sin arrancar',
    ayuda: 'Todavía podés sumar o sacar equipos.',
    clase: 'border-slate-200 bg-slate-100 text-slate-700',
  },
  fase_grupos: {
    label: 'En juego',
    ayuda: 'Cargá los resultados a medida que se juegan.',
    clase: 'border-turf/30 bg-turf/10 text-turf-accessible',
  },
  eliminatoria: {
    label: 'En llaves',
    ayuda: 'Cada partido define quién sigue.',
    clase: 'border-orange/30 bg-orange/10 text-orange-accessible',
  },
  finalizado: {
    label: 'Terminado',
    ayuda: 'Ya hay campeón.',
    clase: 'border-slate-800/20 bg-slate-800/10 text-slate-800',
  },
};

export function estadoDe(id) {
  return ESTADOS[id] || ESTADOS.borrador;
}
