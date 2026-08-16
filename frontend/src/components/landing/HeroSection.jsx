import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Shuffle, Users, LineChart, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import VideoHero from '@/components/media/VideoHero';
import { HERO_CLIPS } from '@/constants/media';

/**
 * Señales de confianza: describen lo que la app hace, no métricas inventadas.
 * Si algún día tenemos números reales (partidos organizados, jugadores) van acá.
 */
const SENALES = [
  { icon: Shuffle, titulo: 'Equipos parejos', detalle: 'Balance automático por nivel y posición' },
  { icon: Users, titulo: 'Fútbol 5 a 11', detalle: 'Frecuentes e invitados en el mismo partido' },
  { icon: LineChart, titulo: 'Rating que evoluciona', detalle: 'Cada partido actualiza la ficha' },
  { icon: LayoutGrid, titulo: 'Formación en la canchita', detalle: 'Quién juega dónde, antes de jugar' },
];

/**
 * Delay de entrada. `animationFillMode: 'both'` es imprescindible: sin eso el
 * elemento se ve un frame en su estado final antes de que arranque la animación.
 */
const entrada = (ms) => ({ animationDelay: `${ms}ms`, animationFillMode: 'both' });

// 8s es lo que pide el catálogo: los clips del hero duran 8s o más, así que con
// este intervalo ninguno se reinicia a la vista del usuario.
const INTERVALO_HERO = 8000;

export default function HeroSection() {
  return (
    <VideoHero
      clips={HERO_CLIPS}
      interval={INTERVALO_HERO}
      overlay="hero"
      className="min-h-[92vh]"
      showDots
    >
      <div className="mx-auto flex min-h-[92vh] w-full max-w-6xl flex-col justify-end px-4 pb-28 pt-24 md:pb-32">
        <p
          className="animate-fade-in motion-reduce:animate-none flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-turf-light"
          style={entrada(0)}
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-turf-light animate-glow-pulse motion-reduce:animate-none" />
          Armá el partido en minutos, no en 200 mensajes
        </p>

        <h1
          className="animate-slide-up motion-reduce:animate-none mt-4 max-w-3xl font-heading text-4xl font-bold uppercase leading-[0.95] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
          data-testid="hero-title"
          style={entrada(90)}
        >
          Organizá tus partidos como un{' '}
          <span className="text-gradient-turf">profesional</span>
        </h1>

        <p
          className="animate-slide-up motion-reduce:animate-none mt-5 max-w-xl text-base leading-relaxed text-white/85 md:text-lg"
          style={entrada(180)}
        >
          Creá partidos, armá equipos balanceados automáticamente y llevá el historial de rendimiento de
          cada jugador.
        </p>

        <div className="animate-slide-up motion-reduce:animate-none mt-8 flex flex-wrap gap-3" style={entrada(260)}>
          <Button
            asChild
            shape="pill"
            data-testid="hero-register-btn"
            className="h-14 bg-white px-8 text-base text-turf-accessible shadow-lift hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Link to="/registro">
              Comenzar gratis <ArrowRight className="ml-1" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            shape="pill"
            data-testid="hero-login-btn"
            className="h-14 border-white/45 bg-white/5 px-8 text-base text-white backdrop-blur-sm hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Link to="/login">Ya tengo cuenta</Link>
          </Button>
        </div>

        <ul
          className="animate-fade-in motion-reduce:animate-none mt-10 grid grid-cols-2 gap-2.5 md:mt-12 md:grid-cols-4 md:gap-3"
          style={entrada(380)}
        >
          {SENALES.map((s) => (
            <li key={s.titulo} className="glass-dark flex items-start gap-2.5 rounded-2xl p-3 md:p-4">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-turf/25">
                <s.icon className="h-4 w-4 text-turf-light" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-heading text-sm font-bold uppercase leading-tight tracking-tight text-white md:text-base">
                  {s.titulo}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-white/70 md:text-xs">
                  {s.detalle}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </VideoHero>
  );
}
