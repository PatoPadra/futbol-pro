import React from 'react';
import { CalendarDays, Plus } from 'lucide-react';

import VideoBackground from '@/components/media/VideoBackground';
import { Button } from '@/components/ui/button';
import { AMBIENT_CLIPS, getClip } from '@/constants/media';
import { ON_DARK_CTA } from './tokens';

/**
 * Único video que se reproduce en el panel (regla de presupuesto: uno por
 * pantalla). Es la vista aérea de un partido: movimiento lento y parejo, así el
 * saludo encima se sigue leyendo, y es mixto, que para la pantalla de entrada
 * importa. Elegido por id y no por índice del set, y con 23s de duración a
 * propósito: un clip corto acá se reinicia a la vista todo el tiempo, porque el
 * banner se mira mucho. Si algún día sale del catálogo, VideoBackground se
 * queda en el poster sin romper la franja.
 */
const BANNER_CLIP = getClip(41372) || AMBIENT_CLIPS[0];

/**
 * Franja de bienvenida: saludo, resumen de la semana y el CTA de crear partido.
 * Es una franja, no un hero a pantalla completa — esto es una app de uso diario
 * y abajo tiene que entrar contenido sin scrollear.
 */
export default function WelcomeBanner({ name, upcomingCount, canCreate, onCreateMatch }) {
  const resumen =
    upcomingCount > 0
      ? `Tenés ${upcomingCount} partido${upcomingCount > 1 ? 's' : ''} próximo${upcomingCount > 1 ? 's' : ''}`
      : 'No hay partidos próximos. ¡Buen momento para organizar uno!';

  return (
    <VideoBackground
      clip={BANNER_CLIP}
      priority
      overlay="turf"
      className="mb-5 rounded-3xl shadow-lift md:mb-6"
      mediaClassName="animate-ken-burns motion-reduce:animate-none"
    >
      <div className="relative noise">
        <div aria-hidden="true" className="absolute inset-0 bg-pitch-stripes opacity-70" />

        <div className="relative flex flex-col gap-5 px-5 py-6 md:flex-row md:items-end md:justify-between md:gap-8 md:px-9 md:py-9">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-turf-light">
              Tu panel
            </p>
            <h1 className="mt-1.5 font-heading text-4xl font-bold uppercase tracking-tight text-white md:text-5xl">
              Hola, {name}
            </h1>
            <p className="mt-2 flex items-start gap-2 text-sm text-white/85 md:text-base">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-turf-light" aria-hidden="true" />
              <span>{resumen}</span>
            </p>
          </div>

          {canCreate && (
            <>
              <Button
                data-testid="dashboard-create-match-mobile"
                onClick={onCreateMatch}
                shape="pill"
                className={`h-11 w-full md:hidden ${ON_DARK_CTA}`}
              >
                <Plus className="mr-1.5 h-5 w-5" /> Crear Partido
              </Button>
              <Button
                data-testid="dashboard-create-match"
                onClick={onCreateMatch}
                shape="pill"
                className={`hidden h-11 shrink-0 px-6 md:flex ${ON_DARK_CTA}`}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Crear Partido
              </Button>
            </>
          )}
        </div>
      </div>
    </VideoBackground>
  );
}
