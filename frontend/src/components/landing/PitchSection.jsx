import React from 'react';
import { Check } from 'lucide-react';
import VideoBackground from '@/components/media/VideoBackground';
import Reveal from '@/components/common/Reveal';
import { AMBIENT_CLIPS } from '@/constants/media';

/**
 * Formación de muestra: arquero, tres al fondo, dos en el medio y uno arriba.
 * Es fútbol 7 — el chip de abajo dice lo mismo que se ve en la canchita.
 */
const MOCK_PLAYERS = [
  { top: '18%', left: '50%', label: 'PT' },
  { top: '38%', left: '22%', label: 'DEF' },
  { top: '38%', left: '50%', label: 'DEF' },
  { top: '38%', left: '78%', label: 'DEF' },
  { top: '62%', left: '35%', label: 'MED' },
  { top: '62%', left: '65%', label: 'MED' },
  { top: '85%', left: '50%', label: 'DEL' },
];

const PUNTOS = [
  'Dos equipos con nivel promedio parejo',
  'Cada uno en la posición que juega',
  'La formación, visible antes del partido',
];

/** Un solo clip, tranquilo, para no pelearle la atención al contenido. */
const FONDO = AMBIENT_CLIPS[0];

export default function PitchSection() {
  return (
    <section id="la-cancha" className="scroll-mt-20">
      <VideoBackground
        clip={FONDO}
        overlay="turf"
        className="noise"
        mediaClassName="scale-105 animate-ken-burns motion-reduce:animate-none motion-reduce:scale-100"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-14 md:py-24">
          <Reveal from="left">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-turf-light">
              Antes de pisar la cancha
            </span>
            <h2 className="mt-3 font-heading text-3xl font-bold uppercase tracking-tight text-white md:text-4xl">
              Vas a ver la formación antes de pisar la cancha
            </h2>
            <p className="mt-4 leading-relaxed text-white/80">
              Una vez cerrada la inscripción, generamos dos equipos equilibrados y los mostramos sobre una
              cancha táctica: quién juega dónde, con foto y todo, para que no haya sorpresas el día del
              partido.
            </p>
            <ul className="mt-6 space-y-3">
              {PUNTOS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-white/85 md:text-base">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-turf/30 ring-1 ring-inset ring-turf-light/40">
                    <Check className="h-3.5 w-3.5 text-turf-light" aria-hidden="true" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal from="right" delay={120} className="glass-dark rounded-3xl p-3 shadow-lift">
            <div
              className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-pitch shadow-inner"
              data-testid="landing-pitch-preview"
            >
              {/* Líneas de la cancha */}
              <div aria-hidden="true" className="absolute inset-0 bg-pitch-stripes opacity-80" />
              <div aria-hidden="true" className="absolute inset-0">
                <div className="absolute inset-2 rounded-lg border-2 border-white/30" />
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/30" />
                <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30" />
                <div className="absolute left-1/2 top-2 h-10 w-28 -translate-x-1/2 rounded-b-lg border-x-2 border-b-2 border-white/25" />
                <div className="absolute bottom-2 left-1/2 h-10 w-28 -translate-x-1/2 rounded-t-lg border-x-2 border-t-2 border-white/25" />
              </div>

              {/* Barrido de luz: se lee como "generando equipos". */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-1/3 animate-pitch-sweep bg-gradient-to-r from-transparent via-white/15 to-transparent motion-reduce:animate-none motion-reduce:hidden"
              />

              {MOCK_PLAYERS.map((p, i) => (
                <div
                  key={`${p.label}-${i}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ top: p.top, left: p.left }}
                >
                  <Reveal from="scale" delay={200 + i * 110}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-white text-[9px] font-bold text-slate-800 shadow-lg">
                      {p.label}
                    </span>
                  </Reveal>
                </div>
              ))}

              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                Fútbol 7 · 3-2-1
              </span>
            </div>

            <p className="px-2 pb-1 pt-3 text-center text-xs text-white/65">
              Ejemplo de formación generada por la app.
            </p>
          </Reveal>
        </div>
      </VideoBackground>
    </section>
  );
}
