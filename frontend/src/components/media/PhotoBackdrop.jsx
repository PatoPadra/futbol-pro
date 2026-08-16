import React, { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Fondo de foto con scrim. Es el equivalente de VideoBackground para imagen
 * fija, y el unico camino permitido para poner una foto de fondo.
 *
 * Por que existe en lugar de un `<img>` suelto:
 *  - Centraliza los scrims, que estan calibrados para que el texto blanco
 *    encima llegue a 4.5:1. El futbol tiene mucho cesped claro y cielo: sin
 *    scrim el titulo se pierde en la mitad de las fotos del catalogo.
 *  - Hace lazy loading por defecto y respeta `forma`: estirar una foto vertical
 *    en una banda ancha la recorta a una tira sin sentido, asi que avisa en
 *    desarrollo cuando eso pasa.
 *  - Si el archivo falla, queda el fondo oscuro y el texto sigue legible en vez
 *    de romper la pantalla.
 *
 * La foto es decorativa: va con aria-hidden y el texto lo pone quien lo usa.
 */
export default function PhotoBackdrop({
  foto,
  /** Scrim. Ver SCRIMS abajo. */
  scrim = 'banda',
  /** Solo para lo que se ve en el primer viewport. */
  priority = false,
  /** object-position, para correr el encuadre si la accion queda tapada. */
  posicion = '50% 45%',
  className,
  mediaClassName,
  children,
  ...rest
}) {
  const [falló, setFalló] = useState(false);

  if (process.env.NODE_ENV !== 'production' && foto && foto.forma === 'alta') {
    // No es un error fatal: hay usos legitimos (panel lateral). Pero si aparece
    // en una banda de encabezado, el recorte va a quedar mal y conviene saberlo.
    if (scrim === 'banda') {
      // eslint-disable-next-line no-console
      console.warn(
        `[PhotoBackdrop] La foto ${foto.key} es vertical (ratio ${foto.ratio}) y se está ` +
        'usando con scrim="banda". Elegí una de forma "ancha" con pickFotos({ forma: "ancha" }).',
      );
    }
  }

  return (
    <div
      className={cn('relative overflow-hidden bg-slate-900', className)}
      // El data-testid propio es un fallback: si quien lo usa pasa uno, gana el suyo.
      data-testid={foto ? `foto-bg-${foto.key}` : undefined}
      {...rest}
    >
      {foto && !falló && (
        <img
          src={foto.src}
          alt=""
          aria-hidden="true"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : undefined}
          onError={() => setFalló(true)}
          className={cn('absolute inset-0 h-full w-full object-cover', mediaClassName)}
          style={{ objectPosition: posicion }}
        />
      )}

      {scrim !== 'none' && (
        <div aria-hidden="true" className={cn('absolute inset-0', SCRIMS[scrim] || SCRIMS.banda)} />
      )}

      {children != null && <div className="relative z-10 h-full">{children}</div>}
    </div>
  );
}

/**
 * Scrims calibrados para texto blanco. Todos dejan al menos 4.5:1 en la zona
 * donde va el contenido.
 */
const SCRIMS = {
  /** Banda de encabezado de pagina: oscuro abajo a la izquierda, donde va el titulo. */
  banda: 'bg-gradient-to-tr from-slate-950/90 via-slate-950/70 to-slate-950/45',
  /** Panel lateral alto (columna de una pantalla partida). */
  panel: 'bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-slate-950/40',
  /** Tarjeta: solo el pie oscuro, para que se vea la foto. */
  tarjeta: 'bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent',
  /** Verde de marca, para bloques que quieren leerse como "nuestros". */
  turf: 'bg-gradient-to-br from-turf-dark/90 via-slate-950/80 to-slate-950/90',
  /** Estado vacio: bien apagado, la foto acompania y no compite. */
  vacio: 'bg-slate-950/80',
  /** Velo plano, para poner tarjetas claras encima. */
  velo: 'bg-slate-950/75',
  none: '',
};

export { SCRIMS };
