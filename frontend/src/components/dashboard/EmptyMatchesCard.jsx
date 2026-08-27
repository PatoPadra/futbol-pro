import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users } from 'lucide-react';

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

/**
 * Estado vacío de "próximos partidos": foto de cancha con scrim y el CTA.
 *
 * TRES CASOS, NO DOS. El que no puede crear partidos puede estar en dos
 * situaciones muy distintas y antes se las trataba igual:
 *
 *   - Está en un grupo y espera la próxima fecha. Ahí "cuando tu organizador
 *     arme la fecha te aparece acá" es cierto y alcanza.
 *   - NO está en ningún grupo. Ahí esa frase le habla de un organizador que no
 *     tiene, y la pantalla es un callejón sin salida: completó todo el alta
 *     para quedarse mirando una foto.
 *
 * El segundo caso ahora tiene dos salidas de verdad: armar su propio grupo, o
 * entrar al de alguien con un link. Antes ninguna de las dos existía.
 */
export default function EmptyMatchesCard({ canCreate, onCreateMatch, sinGrupos = false }) {
  if (sinGrupos) {
    return <SinGrupos />;
  }

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

/**
 * Todavía no está en ningún grupo. Es la primera pantalla real de la app para
 * quien llegó solo, así que dice qué es un grupo y ofrece las dos puertas.
 */
function SinGrupos() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-900 shadow-lift" data-testid="empty-no-groups">
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
        className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/85 to-slate-950/60"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-pitch-stripes opacity-70" />

      <div className="relative flex flex-col items-center px-6 py-10 text-center md:py-14">
        <span className="glass-dark flex h-12 w-12 items-center justify-center rounded-2xl text-turf-light">
          <Users className="h-6 w-6" aria-hidden="true" />
        </span>
        <h3 className="mt-4 font-heading text-2xl font-bold uppercase tracking-tight text-white md:text-3xl">
          Empezá por tu grupo
        </h3>
        <p className="mt-2 max-w-sm text-sm text-white/80">
          Un grupo es la gente con la que jugás siempre. Armá el tuyo y sumalos con
          un link, o entrá al de alguien si ya te pasaron uno.
        </p>

        <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/grupos/crear" className="rounded-full focus-visible:outline-none">
            <Button shape="pill" className={`h-11 w-full px-8 sm:w-auto ${ON_DARK_CTA}`} data-testid="empty-create-group">
              Crear mi grupo
            </Button>
          </Link>
          <Link to="/grupos" className="rounded-full focus-visible:outline-none">
            <Button
              variant="outline"
              shape="pill"
              className="h-11 w-full border-white/30 bg-white/10 px-8 text-white hover:bg-white/20 sm:w-auto"
              data-testid="empty-join-group"
            >
              Tengo un link
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
