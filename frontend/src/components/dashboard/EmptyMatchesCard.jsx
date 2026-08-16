import React from 'react';
import { Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getClip } from '@/constants/media';
import { ON_DARK_CTA } from './tokens';

/**
 * Poster, no video: el único video de la página es el del banner de bienvenida.
 * Elegimos el clip de futsal femenino a propósito — el panel vacío es una de las
 * pantallas que más se ve al arrancar y no queremos que todo sea fútbol 11
 * masculino.
 */
const EMPTY_CLIP = getClip(42537);

/** Estado vacío de "próximos partidos": foto de cancha con scrim y el CTA. */
export default function EmptyMatchesCard({ canCreate, onCreateMatch }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-900 shadow-lift">
      {EMPTY_CLIP && (
        <img
          src={EMPTY_CLIP.poster}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: EMPTY_CLIP.focus }}
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-slate-950/55"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-pitch-stripes opacity-70" />

      <div className="relative flex flex-col items-center px-6 py-10 text-center md:py-14">
        <span className="glass-dark flex h-12 w-12 items-center justify-center rounded-2xl text-turf-light">
          <Trophy className="h-6 w-6" aria-hidden="true" />
        </span>
        <h3 className="mt-4 font-heading text-2xl font-bold uppercase tracking-tight text-white md:text-3xl">
          No hay partidos próximos
        </h3>
        <p className="mt-2 max-w-sm text-sm text-white/80">
          {canCreate
            ? 'Armá la próxima fecha, poné cancha y horario, y dejá que los titulares se vayan completando solos.'
            : 'Cuando tu organizador arme la próxima fecha te va a aparecer acá.'}
        </p>
        {canCreate && (
          <Button
            onClick={onCreateMatch}
            shape="pill"
            className={`mt-6 h-11 px-8 ${ON_DARK_CTA}`}
            data-testid="empty-create-match"
          >
            Crear Partido
          </Button>
        )}
      </div>
    </div>
  );
}
