import { useEffect, useState } from 'react';

/**
 * true si el sistema pide menos movimiento. Escuchamos el cambio en vivo:
 * alguien puede activar "reducir movimiento" con la pestaña abierta y el video
 * tiene que frenar sin recargar.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * true cuando bajar video sería maltratar la conexión del usuario: modo ahorro
 * de datos activado o red 2g. En ese caso mostramos sólo el poster.
 *
 * navigator.connection no existe en Safari ni Firefox; ahí asumimos que la
 * conexión está bien (que es lo que el navegador nos deja asumir).
 */
export function useSavesData() {
  const [saves, setSaves] = useState(() => readConnection());

  useEffect(() => {
    const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
    if (!conn || !conn.addEventListener) return undefined;
    const onChange = () => setSaves(readConnection());
    conn.addEventListener('change', onChange);
    return () => conn.removeEventListener('change', onChange);
  }, []);

  return saves;
}

function readConnection() {
  const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
  if (!conn) return false;
  if (conn.saveData) return true;
  return conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
}
