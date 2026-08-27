/**
 * Sacar el token de un link de invitacion pegado a mano.
 *
 * Vive aparte de la pantalla porque es logica pura, y porque es exactamente el
 * tipo de cosa que falla con entradas que nadie previo: la gente copia links
 * desde WhatsApp con el "https://" comido, desde un mail con un espacio al
 * final, o pega solo el codigo porque el link se corto en dos lineas.
 *
 * Quedarse afuera de un grupo por un espacio de mas seria absurdo.
 */
export function tokenDe(texto) {
  const limpio = (texto || '').trim();
  if (!limpio) return '';

  // El link entero: nos quedamos con lo que sigue a /invitacion/, cortando en
  // la primera barra, query o ancla.
  const match = limpio.match(/\/invitacion\/([^/?#\s]+)/);
  if (match) return match[1];

  // Si tiene pinta de URL pero no es de invitacion, no inventamos un token con
  // el ultimo pedazo: seria mandar a la persona a un 404 confuso en vez de
  // decirle que el link esta mal.
  if (/^https?:\/\//i.test(limpio) || limpio.includes('/')) return '';

  // El codigo pelado. Es url-safe base64, asi que no tiene espacios ni barras.
  return /^[A-Za-z0-9_-]+$/.test(limpio) ? limpio : '';
}

export default tokenDe;
