/**
 * Género del jugador.
 *
 * La lista canónica vive en el backend (`constants.py` / `GET /api/genders`);
 * ésta es la copia que usa la UI para no tener que esperar un round-trip sólo
 * para pintar cuatro botones. Si agregás una opción, agregala en los dos lados.
 *
 * Es un dato del perfil y ADEMÁS entra en el armado de equipos: el balanceador
 * reparte cada género en partes iguales entre los dos equipos. Por eso vale la
 * pena pedirlo en el onboarding y no esconderlo en una pantalla de ajustes.
 */

export const GENEROS = [
  { id: 'masculino', label: 'Masculino', corto: 'M' },
  { id: 'femenino', label: 'Femenino', corto: 'F' },
  { id: 'otro', label: 'Otro', corto: 'X' },
  // Existe para que el campo se pueda completar sin obligar a nadie a declarar
  // nada. Para el balanceador cae en la misma bolsa que "todavía no lo cargó".
  { id: 'prefiero_no_decir', label: 'Prefiero no decir', corto: '—' },
];

export const GENERO_IDS = GENEROS.map((g) => g.id);

const POR_ID = new Map(GENEROS.map((g) => [g.id, g]));

/** Etiqueta legible. Devuelve null si no hay dato, para que el llamador decida. */
export function labelDeGenero(id) {
  return POR_ID.get(id)?.label || null;
}

/**
 * Etiqueta para mostrar en la ficha. A diferencia de `labelDeGenero`, "prefiero
 * no decir" se muestra como "Sin especificar": en una ficha ajena, repetir la
 * frase de la opción suena a que la persona te está contestando algo.
 */
export function labelDeFicha(id) {
  if (!id || id === 'prefiero_no_decir') return null;
  return labelDeGenero(id);
}
