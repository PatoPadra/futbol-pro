import React, { useState } from 'react';
import { Hand, ChevronLeft, ChevronRight } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import Reveal from '@/components/common/Reveal';
import { SHOWCASE_CLIPS, NIVEL_LABELS, GENERO_LABELS } from '@/constants/media';

/**
 * Un color por género. No es decoración: es la forma más rápida de que se vea,
 * de un vistazo, que acá se juega masculino, femenino y mixto.
 */
const CHIP_GENERO = {
  masculino: 'border-sky-300/40 bg-sky-500/20 text-sky-100',
  femenino: 'border-fuchsia-300/40 bg-fuchsia-500/20 text-fuchsia-100',
  mixto: 'border-amber-300/40 bg-amber-500/20 text-amber-100',
};

const CHIP_BASE =
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider';

const CONTROL =
  'border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

export default function ShowcaseCarousel() {
  // Manejamos los controles con la API de Embla en lugar de CarouselPrevious /
  // CarouselNext: esos traen su etiqueta accesible en inglés y ese archivo es
  // compartido, no lo tocamos desde acá.
  const [embla, setEmbla] = useState(null);

  return (
    <section
      id="asi-se-juega"
      className="noise relative scroll-mt-20 overflow-hidden bg-slate-950 py-16 md:py-24"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-mesh-dark" />

      <div className="relative mx-auto max-w-6xl px-4">
        <Reveal from="up" className="max-w-2xl">
          <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-white md:text-4xl">
            Así se juega
          </h2>
          <p className="mt-3 text-base leading-relaxed text-white/70">
            Fútbol de verdad, del que se juega un martes a la noche y del que se juega en serio. Masculino,
            femenino y mixto: la app es la misma para todos.
          </p>
        </Reveal>

        <Reveal from="up" delay={90} className="mt-6 flex flex-wrap items-center gap-2">
          {Object.entries(GENERO_LABELS).map(([clave, etiqueta]) => (
            <span key={clave} className={`${CHIP_BASE} ${CHIP_GENERO[clave]}`}>
              {etiqueta}
            </span>
          ))}
          <span className={`${CHIP_BASE} border-white/25 bg-white/10 text-white/90`}>
            {NIVEL_LABELS.amateur}
          </span>
          <span className={`${CHIP_BASE} border-white/25 bg-white/10 text-white/90`}>
            {NIVEL_LABELS.profesional}
          </span>
        </Reveal>

        <Carousel
          opts={{ align: 'start', loop: true }}
          setApi={setEmbla}
          className="mt-10"
          aria-label="Galería de partidos: masculino, femenino y mixto"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/55">
              <Hand className="h-4 w-4" aria-hidden="true" />
              Arrastrá para ver más
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                shape="pill"
                onClick={() => embla?.scrollPrev()}
                data-testid="showcase-prev-btn"
                aria-label="Ver los clips anteriores"
                className={CONTROL}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                shape="pill"
                onClick={() => embla?.scrollNext()}
                data-testid="showcase-next-btn"
                aria-label="Ver los clips siguientes"
                className={CONTROL}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>

          <CarouselContent className="mt-6">
            {SHOWCASE_CLIPS.map((clip, i) => (
              <CarouselItem key={clip.key} className="basis-[80%] sm:basis-1/2 lg:basis-1/3">
                <article
                  data-testid={`showcase-slide-${i}`}
                  className="group relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-lift"
                >
                  {/* Poster como imagen de fondo: son doce tarjetas a la vez, con
                      <video> esto sería una estufa. */}
                  <img
                    src={clip.poster}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] motion-reduce:transition-none"
                    style={{ objectPosition: clip.focus }}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/35 to-slate-950/10"
                  />
                  <div className="relative flex h-full flex-col justify-end gap-3 p-5">
                    <div className="flex flex-wrap gap-2">
                      <span className={`${CHIP_BASE} ${CHIP_GENERO[clip.genero]}`}>
                        {GENERO_LABELS[clip.genero]}
                      </span>
                      <span className={`${CHIP_BASE} border-white/25 bg-white/10 text-white/90`}>
                        {NIVEL_LABELS[clip.nivel]}
                      </span>
                    </div>
                    <p className="font-heading text-lg font-bold uppercase leading-tight tracking-tight text-white">
                      {clip.alt}
                    </p>
                  </div>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  );
}
