import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  usePrefersReducedMotion,
  useSavesData,
  useVideoQuality,
} from '@/hooks/use-media-preferences';

/**
 * Video de fondo decorativo.
 *
 * Reglas que sigue, en orden de prioridad:
 *  1. Nunca baja un byte de video si el usuario pidió menos movimiento o está
 *     en ahorro de datos / 2g. En esos casos queda el poster y listo.
 *  2. No baja nada hasta que el elemento entra en viewport (salvo `priority`,
 *     para el primer slide del hero que se ve en el primer paint).
 *  3. Si es parte de un carrusel, sólo reproduce el slide activo (`active`).
 *     Seis videos corriendo a la vez funden la batería de cualquier celular.
 *  4. Si el archivo falla, se queda en el poster sin romper nada.
 *
 * Es decorativo: va con aria-hidden y el texto encima lo pone el que lo usa.
 */
export default function VideoBackground({
  clip,
  active = true,
  priority = false,
  /** Scrim encima del video. Sin esto el texto blanco no se lee. */
  overlay = 'default',
  className,
  /** Clases extra para el <video>/poster, p.ej. escala o blur. */
  mediaClassName,
  children,
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const savesData = useSavesData();
  const quality = useVideoQuality();

  const [inView, setInView] = useState(priority);
  const [canPlay, setCanPlay] = useState(false);
  const [failed, setFailed] = useState(false);

  // Con movimiento reducido o ahorro de datos el video no existe: sólo poster.
  // `tieneVideo === false` significa que ese clip está en el catálogo sólo como
  // imagen (no bajamos su mp4): pedirlo sería un 404 garantizado.
  const videoAllowed =
    Boolean(clip) && clip.tieneVideo !== false && !reducedMotion && !savesData && !failed;
  const shouldLoad = videoAllowed && inView;

  // Observamos el contenedor para no bajar video que nadie está mirando.
  useEffect(() => {
    if (priority || !videoAllowed) return undefined;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setInView(entry.isIntersecting));
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [priority, videoAllowed]);

  // Reproducir/pausar según si este slide está activo y visible.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad) return;

    if (active && inView) {
      // play() rechaza si la política de autoplay lo bloquea. No es un error
      // que valga la pena mostrar: se queda el poster, que es aceptable.
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      video.pause();
    }
  }, [active, inView, shouldLoad, canPlay]);

  // Al cambiar de clip o de calidad reseteamos el estado: si no, el poster
  // queda oculto detrás de un video que todavía no cargó.
  useEffect(() => {
    setCanPlay(false);
  }, [clip?.key, quality]);

  if (!clip) return <div className={cn('relative overflow-hidden', className)}>{children}</div>;

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden bg-slate-900', className)}
      data-testid={`video-bg-${clip.key}`}
    >
      {/* Poster: es lo que se ve en el primer paint y el fallback permanente. */}
      <img
        src={clip.poster}
        alt=""
        aria-hidden="true"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-opacity [transition-duration:700ms]',
          canPlay ? 'opacity-0' : 'opacity-100',
          mediaClassName,
        )}
        style={{ objectPosition: clip.focus }}
      />

      {shouldLoad && (
        <video
          ref={videoRef}
          key={`${clip.key}-${quality}`}
          src={quality === '360' ? clip.src360 : clip.src720}
          poster={clip.poster}
          muted
          loop
          playsInline
          autoPlay={active}
          preload={priority ? 'auto' : 'metadata'}
          aria-hidden="true"
          tabIndex={-1}
          onCanPlay={() => setCanPlay(true)}
          onError={() => setFailed(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity [transition-duration:700ms] motion-reduce:hidden',
            canPlay ? 'opacity-100' : 'opacity-0',
            mediaClassName,
          )}
          style={{ objectPosition: clip.focus }}
        />
      )}

      {overlay !== 'none' && (
        <div aria-hidden="true" className={cn('absolute inset-0', OVERLAYS[overlay] || OVERLAYS.default)} />
      )}

      {children != null && <div className="relative z-10 h-full">{children}</div>}
    </div>
  );
}

/**
 * Scrims. Todos garantizan al menos 4.5:1 para texto blanco sobre la zona donde
 * va el contenido — el fútbol tiene mucho verde claro y cielo, y sin scrim el
 * título se pierde.
 */
const OVERLAYS = {
  default: 'bg-slate-950/45',
  // Para heroes: oscuro abajo (donde va el texto), más limpio arriba.
  hero: 'bg-gradient-to-t from-slate-950/75 via-slate-950/45 to-slate-950/25',
  // Para tarjetas de carrusel: sólo el pie oscuro.
  card: 'bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent',
  // Verde de marca, para secciones que quieren leerse como "nuestras".
  turf: 'bg-gradient-to-br from-turf-dark/75 via-slate-950/60 to-slate-950/75',
  // Apenas un velo, para fondos detrás de tarjetas claras.
  veil: 'bg-slate-950/60',
  none: '',
};

export { OVERLAYS };
