import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Reveal from '@/components/common/Reveal';
import { AMBIENT_CLIPS } from '@/constants/media';

/**
 * Cierre. Va sobre gradiente y no sobre video a propósito: el presupuesto de dos
 * videos ya se lo comen el hero y la sección de la cancha. Acá alcanza con el
 * poster de un clip bien atenuado más la malla oscura.
 */
const FONDO = AMBIENT_CLIPS[2];

export default function FinalCta() {
  return (
    <section className="noise relative overflow-hidden bg-slate-950">
      <img
        src={FONDO.poster}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover opacity-25"
        style={{ objectPosition: FONDO.focus }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-slate-950/70" />
      <div aria-hidden="true" className="absolute inset-0 bg-mesh-dark" />
      <div aria-hidden="true" className="absolute inset-0 bg-pitch-stripes opacity-60" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-turf/25 blur-3xl animate-glow-pulse motion-reduce:animate-none"
      />

      <div className="relative mx-auto max-w-4xl px-4 py-20 text-center md:py-28">
        <Reveal from="up">
          <h2 className="font-heading text-3xl font-bold uppercase leading-tight tracking-tight text-white md:text-5xl">
            ¿Listo para armar tu próximo partido?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/75 md:text-lg">
            Registrate gratis y empezá a organizar partidos con equipos equilibrados.
          </p>
        </Reveal>

        <Reveal from="up" delay={120} className="mt-9 flex flex-col items-center gap-4">
          <Button
            asChild
            shape="pill"
            data-testid="cta-register-btn"
            className="h-14 bg-turf px-10 text-base text-white shadow-lift-turf hover:bg-turf-dark focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Link to="/registro">
              Crear mi cuenta <ArrowRight className="ml-1" aria-hidden="true" />
            </Link>
          </Button>
          <Link
            to="/login"
            data-testid="cta-login-link"
            className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-white/75 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 motion-reduce:transition-none"
          >
            Ya tengo cuenta, quiero entrar
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
