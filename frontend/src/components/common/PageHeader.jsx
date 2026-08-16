import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { cn } from '@/lib/utils';
import PhotoBackdrop from '@/components/media/PhotoBackdrop';
import { fotoDePagina } from '@/constants/fotos';

/**
 * Encabezado de pagina con foto de fondo.
 *
 * Es la pieza que hace que las pantallas interiores se sientan parte de la misma
 * app: una banda con la foto que le corresponde a esa pagina (curada en
 * `fotos.js`, una por pagina y sin repetir), el titulo, y las acciones.
 *
 * Es DELIBERADAMENTE compacta. Esto es una app que alguien usa todos los dias
 * desde el celular, no una landing: una banda de media pantalla obliga a
 * scrollear para llegar a lo que se vino a hacer. Alto util: ~150px en mobile,
 * ~190px en desktop.
 *
 * Va adentro del `page-container` de la pagina, con esquinas redondeadas. No usa
 * margenes negativos para sangrar a los bordes a proposito: el contenedor cambia
 * entre pantallas y sangrar desde el hijo se rompe de formas dificiles de ver.
 */
export default function PageHeader({
  /** Slug del catalogo: define la foto. Ver SLUGS_DE_PAGINA en fotos.js. */
  slug,
  /** Foto explicita, si necesitas una distinta a la del slug. */
  foto,
  /** Texto chico arriba del titulo. */
  eyebrow,
  titulo,
  /** Una linea de contexto abajo del titulo. */
  bajada,
  /** Ruta del link "volver". */
  volverA,
  volverLabel = 'Volver',
  /**
   * data-testid del link de volver. Varias páginas ya traían el suyo desde
   * antes (back-to-match-post, back-to-post-match) y hay tests que dependen de
   * esos nombres, así que se puede sobreescribir el default.
   */
  volverTestId = 'page-header-volver',
  /** Chips o badges: estado del partido, fecha, modalidad. */
  meta,
  /** Botones de accion, a la derecha en desktop. */
  acciones,
  /** Icono decorativo opcional (componente de lucide). */
  icono: Icono,
  className,
  testId,
  /** Solo en la primera pantalla que ve el usuario al entrar. */
  priority = false,
}) {
  const elegida = foto || fotoDePagina(slug);

  return (
    <PhotoBackdrop
      foto={elegida}
      scrim="banda"
      priority={priority}
      className={cn('rounded-3xl shadow-lift', className)}
      data-testid={testId}
    >
      <div className="flex min-h-[150px] flex-col justify-end gap-3 p-5 md:min-h-[190px] md:p-7">
        {volverA && (
          <Link
            to={volverA}
            data-testid={volverTestId}
            className="-ml-1 inline-flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold uppercase tracking-wider text-white/85 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {volverLabel}
          </Link>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-turf-light">
                {eyebrow}
              </p>
            )}
            <div className="flex items-center gap-3">
              {Icono && (
                <span
                  aria-hidden="true"
                  className="glass-dark grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                >
                  <Icono className="h-5 w-5 text-white" />
                </span>
              )}
              <h1 className="font-heading text-3xl font-bold uppercase leading-none tracking-tight text-white md:text-4xl">
                {titulo}
              </h1>
            </div>
            {bajada && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85">{bajada}</p>
            )}
            {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
          </div>

          {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
        </div>
      </div>
    </PhotoBackdrop>
  );
}
