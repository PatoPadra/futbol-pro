import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import VideoHero from '@/components/media/VideoHero';

/**
 * Layout partido para las pantallas de autenticación (login, registro y el
 * estado de "revisá tu email").
 *
 * Desktop: dos columnas. A la izquierda, video a sangre con el logo arriba y
 * una frase editorial abajo, sobre el scrim que ya trae VideoHero. A la
 * derecha, el formulario sobre superficie clara con ancho de lectura cómodo.
 *
 * Mobile: el video se convierte en una franja corta arriba y el formulario va
 * abajo, en flujo normal del documento. Es a propósito y por dos razones:
 *  1. El formulario nunca queda dentro de un contenedor de altura fija, así
 *     que cuando se abre el teclado la página scrollea y no se recorta nada.
 *  2. Sobre blanco, labels, placeholders y textos de error mantienen su
 *     contraste. Encima de video traslúcido el rojo del error y el gris del
 *     placeholder se caen abajo de 4.5:1.
 *
 * No sabe nada del formulario: recibe `children` y los muestra tal cual. Toda
 * la lógica (submit, validación, errores) queda en la página.
 *
 * Un solo panel de video por pantalla, y dentro del panel sólo reproduce el
 * clip activo — ver VideoHero.
 */
export default function AuthLayout({
  /** data-testid del contenedor raíz. Los tests dependen de estos nombres. */
  testId,
  /** Clips del panel de video. Cada pantalla usa su propia selección. */
  clips,
  /** data-testid del link del logo, distinto en cada pantalla (ya existía). */
  logoTestId,
  /** Línea corta arriba del título editorial. Es lo único que se ve en mobile. */
  eyebrow,
  /** Título editorial del panel oscuro (sólo desktop). */
  editorialTitle,
  /** Párrafo editorial del panel oscuro (sólo desktop). */
  editorialCopy,
  /** Título del formulario: es el h1 de la página. */
  heading,
  /** Bajada opcional debajo del título. */
  subheading,
  /** Ícono opcional arriba del título (lo usa "revisá tu email"). */
  icon: Icon,
  /** 'left' | 'center' — alineación del encabezado del formulario. */
  align = 'left',
  children,
}) {
  const centered = align === 'center';

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50 lg:grid lg:grid-cols-[1.05fr_1fr] lg:items-stretch"
      data-testid={testId}
    >
      {/* Panel de video: franja corta en mobile, columna completa en desktop. */}
      <VideoHero
        clips={clips}
        interval={10000}
        overlay="hero"
        showDots={false}
        className="noise h-40 shrink-0 sm:h-52 lg:sticky lg:top-0 lg:h-screen"
      >
        <div className="flex h-full flex-col justify-between p-5 sm:p-6 lg:p-12 xl:p-16">
          <Link
            to="/"
            data-testid={logoTestId}
            className="flex w-fit items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-turf shadow-lg shadow-turf/25">
              <Trophy className="h-6 w-6 text-white" aria-hidden="true" />
            </span>
            <span className="font-heading text-2xl font-bold uppercase tracking-tight text-white [text-shadow:0_1px_10px_rgba(2,6,23,0.7)]">
              App Futbol
            </span>
          </Link>

          <div className="max-w-lg">
            {eyebrow && (
              <p className="font-heading text-xs font-semibold uppercase tracking-[0.22em] text-turf-light [text-shadow:0_1px_10px_rgba(2,6,23,0.7)] sm:text-sm">
                {eyebrow}
              </p>
            )}
            {editorialTitle && (
              <p className="mt-3 hidden font-heading text-4xl uppercase leading-[0.95] tracking-tight text-white lg:block xl:text-5xl">
                {editorialTitle}
              </p>
            )}
            {editorialCopy && (
              <p className="mt-4 hidden max-w-md font-body text-base leading-relaxed text-slate-200 lg:block">
                {editorialCopy}
              </p>
            )}
          </div>
        </div>
      </VideoHero>

      {/* Columna del formulario: superficie clara con malla, nunca blanco plano. */}
      <main className="flex flex-1 items-start justify-center bg-slate-50 bg-mesh-turf px-4 py-8 sm:px-6 sm:py-12 lg:items-center lg:px-10 lg:py-16">
        <div className="w-full max-w-md animate-slide-up motion-reduce:animate-none">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lift sm:p-8">
            <div className={cn('mb-6', centered && 'text-center')}>
              {Icon && (
                <div
                  className={cn(
                    'mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-turf/10',
                    centered && 'mx-auto',
                  )}
                >
                  <Icon className="h-7 w-7 text-turf-accessible" aria-hidden="true" />
                </div>
              )}
              <h1 className="font-heading text-3xl uppercase tracking-tight text-slate-900">{heading}</h1>
              {subheading && <p className="mt-2 font-body text-sm leading-relaxed text-slate-500">{subheading}</p>}
            </div>

            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
