import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import VideoBackground from './VideoBackground';
import { usePrefersReducedMotion } from '@/hooks/use-media-preferences';

/**
 * Hero con varios clips que se van cruzando por fundido.
 *
 * Sólo el clip activo se reproduce (los demás ni se montan como video), así que
 * el costo real es el de un video, no el de seis. Con movimiento reducido no
 * rota: se queda en el primero, en poster.
 */
export default function VideoHero({
  clips,
  interval = 8000,
  overlay = 'hero',
  className,
  children,
  showDots = true,
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  // Arranca en false para que el primer paint baje un solo video.
  const [precargarSiguiente, setPrecargarSiguiente] = useState(false);
  const total = clips?.length || 0;

  const go = useCallback(
    (next) => {
      if (!total) return;
      setIndex(((next % total) + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (reducedMotion || total < 2) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % total), interval);
    return () => clearInterval(t);
  }, [reducedMotion, total, interval]);

  // Un tercio del intervalo de espera antes de precargar el siguiente: suficiente
  // para que el clip activo ya se haya bajado, y sobra tiempo para el fundido.
  // Con movimiento reducido no hay rotacion, asi que no hay nada que precargar.
  useEffect(() => {
    if (reducedMotion || total < 2) return undefined;
    const t = setTimeout(() => setPrecargarSiguiente(true), Math.round(interval / 3));
    return () => clearTimeout(t);
  }, [reducedMotion, total, interval]);

  if (!total) return <div className={className}>{children}</div>;

  // Sólo montamos video para el clip visible y el siguiente. Montar los seis
  // (todos son `absolute inset-0`, así que los seis intersecan el viewport y
  // resuelven su IntersectionObserver a true) disparaba seis descargas de mp4
  // al entrar a la página.
  //
  // Y el siguiente se monta con retraso, no de entrada: precargarlo junto con el
  // activo duplicaba la carga inicial (7.6 MB en vez de 3.2 en desktop). Con
  // `precargarSiguiente` en false al principio, el primer paint pide un solo
  // clip y el segundo entra despues, mucho antes de que haga falta para el
  // fundido.
  const nextIndex = total > 1 && precargarSiguiente ? (index + 1) % total : -1;

  return (
    <div className={cn('relative isolate overflow-hidden', className)} data-testid="video-hero">
      {clips.map((clip, i) => {
        if (i !== index && i !== nextIndex) return null;
        return (
          <div
            key={clip.key}
            aria-hidden="true"
            className={cn(
              'absolute inset-0 transition-opacity [transition-duration:1400ms] ease-in-out',
              i === index ? 'opacity-100' : 'opacity-0',
            )}
          >
            <VideoBackground
              clip={clip}
              active={i === index}
              priority={i === 0}
              // Sin scrim propio: lo pone VideoHero una sola vez, mas abajo.
              // Con scrim en las dos capas la opacidad se multiplicaba y el
              // video quedaba casi negro al pie.
              overlay="none"
              className="h-full w-full"
              mediaClassName="scale-105 brightness-110 saturate-105 animate-ken-burns motion-reduce:animate-none motion-reduce:scale-100"
            />
          </div>
        );
      })}

      {/* El unico scrim del hero. Va aca y no en cada VideoBackground porque
          durante el fundido hay dos clips montados: si cada uno trajera el suyo,
          las dos capas se multiplicarian.
          Valores: 0.72 abajo (donde va el titulo, y da 8.9:1 para texto blanco
          incluso sobre una toma clara), y bien liviano arriba para que se vea
          el video. */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/45 to-slate-950/25" />

      <div className="relative z-10 h-full">{children}</div>

      {showDots && total > 1 && (
        <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center">
          {clips.map((clip, i) => (
            /* El botón mide 44x44 (mínimo táctil) aunque el punto se vea de
               10px: seis puntos de 10px separados por 10px son imposibles de
               acertar con el pulgar. */
            <button
              key={clip.key}
              type="button"
              onClick={() => go(i)}
              data-testid={`hero-dot-${i}`}
              aria-label={`Ver clip ${i + 1} de ${total}: ${clip.alt}`}
              aria-current={i === index}
              className="group flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span
                className={cn(
                  'h-2.5 rounded-full transition-all duration-300 motion-reduce:transition-none',
                  i === index ? 'w-8 bg-white' : 'w-2.5 bg-white/45 group-hover:bg-white/75',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
