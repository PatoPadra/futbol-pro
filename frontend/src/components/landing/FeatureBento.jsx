import React from 'react';
import { Trophy, Users, BarChart3, Zap, Shield, ClipboardCheck } from 'lucide-react';
import Reveal from '@/components/common/Reveal';

/**
 * Las mismas seis funciones de siempre. Lo que cambia es el peso visual: `span`
 * arma un bento asimétrico (4+2 / 2+4 / 3+3 sobre doce columnas en desktop) para
 * que la grilla no parezca una planilla.
 */
const FEATURES = [
  {
    icon: Zap,
    title: 'Equipos balanceados',
    desc: 'Algoritmo inteligente que arma dos equipos equilibrados según nivel, posiciones y formación.',
    span: 'md:col-span-4',
    destacada: true,
  },
  {
    icon: Users,
    title: 'Gestioná jugadores',
    desc: 'Registrá jugadores frecuentes e invitados con posiciones preferidas, fotos y nivel de juego.',
    span: 'md:col-span-2',
  },
  {
    icon: BarChart3,
    title: 'Historial y rating',
    desc: 'Seguimiento de rendimiento con evaluaciones de compañeros, estadísticas y evolución.',
    span: 'md:col-span-2',
  },
  {
    icon: Trophy,
    title: 'Formaciones tácticas',
    desc: 'Visualizá formaciones en una canchita interactiva para fútbol 11. 4-4-2, 4-3-3 y más.',
    span: 'md:col-span-4',
    destacada: true,
  },
  {
    icon: Shield,
    title: 'Roles y permisos',
    desc: 'Admins, organizadores y jugadores con diferentes niveles de acceso.',
    span: 'md:col-span-3',
  },
  {
    icon: ClipboardCheck,
    title: 'Post partido',
    desc: 'Evaluaciones cruzadas, estadísticas confirmadas por votación y actualización automática de ratings.',
    span: 'md:col-span-3',
  },
];

export default function FeatureBento() {
  return (
    <section id="funciones" className="scroll-mt-20 bg-white bg-mesh-turf py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal from="up" className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-turf-accessible">
            Todo en un solo lugar
          </span>
          <h2 className="mt-3 font-heading text-3xl font-bold uppercase tracking-tight text-slate-900 md:text-4xl">
            Todo lo que necesitás
          </h2>
          <p className="mt-3 text-slate-600">
            Desde fútbol 5 hasta fútbol 11, con formaciones tácticas y balance automático.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5">
          {FEATURES.map((f, i) => (
            <Reveal
              key={f.title}
              as="article"
              from="up"
              delay={i * 90}
              data-testid={`feature-card-${i}`}
              className={`glass group relative overflow-hidden rounded-3xl p-6 shadow-lift [transition-duration:200ms] hover:-translate-y-1 hover:shadow-lift-turf md:p-7 ${f.span} ${
                f.destacada ? 'md:min-h-[15rem]' : ''
              }`}
            >
              {f.destacada && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-turf/15 blur-2xl animate-glow-pulse motion-reduce:animate-none"
                />
              )}
              <div className="relative">
                <span
                  className={`flex items-center justify-center rounded-2xl bg-turf/10 ring-1 ring-inset ring-turf/20 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none ${
                    f.destacada ? 'h-14 w-14' : 'h-12 w-12'
                  }`}
                >
                  <f.icon
                    className={f.destacada ? 'h-7 w-7 text-turf-accessible' : 'h-6 w-6 text-turf-accessible'}
                    aria-hidden="true"
                  />
                </span>
                <h3
                  className={`mt-5 font-heading font-bold uppercase tracking-tight text-slate-900 ${
                    f.destacada ? 'text-2xl md:text-3xl' : 'text-xl'
                  }`}
                >
                  {f.title}
                </h3>
                <p
                  className={`mt-2 leading-relaxed text-slate-600 ${
                    f.destacada ? 'max-w-md text-base' : 'text-sm'
                  }`}
                >
                  {f.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
