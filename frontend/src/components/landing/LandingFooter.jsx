import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';

/** Sólo rutas y anclas que existen de verdad. Nada de links de adorno. */
const CUENTA = [
  { to: '/registro', label: 'Crear cuenta', testid: 'footer-register-link' },
  { to: '/login', label: 'Ingresar', testid: 'footer-login-link' },
];

const ANCLAS = [
  { href: '#asi-se-juega', label: 'Así se juega' },
  { href: '#funciones', label: 'Funciones' },
  { href: '#la-cancha', label: 'La canchita' },
  { href: '#como-funciona', label: 'Cómo funciona' },
];

const MODALIDADES = ['Fútbol 5, 7, 8 y 11', 'Masculino, femenino y mixto', 'Amateur y profesional'];

const ENLACE =
  'inline-flex min-h-[44px] items-center rounded-lg text-sm text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 motion-reduce:transition-none';

export default function LandingFooter() {
  return (
    <footer
      className="border-t border-white/10 bg-slate-950 pb-10 pt-14"
      data-testid="landing-footer"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              data-testid="footer-logo-link"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-turf">
                <Trophy className="h-4 w-4 text-white" aria-hidden="true" />
              </span>
              <span className="font-heading text-lg font-bold uppercase tracking-tight text-white">
                App Futbol
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
              Organizá partidos, armá equipos parejos y seguí el rendimiento de cada jugador. Gratis para
              arrancar.
            </p>
          </div>

          <nav aria-label="Tu cuenta">
            <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-white">
              Tu cuenta
            </h2>
            <ul className="mt-2">
              {CUENTA.map((c) => (
                <li key={c.to}>
                  <Link to={c.to} data-testid={c.testid} className={ENLACE}>
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Secciones de esta página">
            <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-white">
              Esta página
            </h2>
            <ul className="mt-2">
              {ANCLAS.map((a) => (
                <li key={a.href}>
                  <a
                    href={a.href}
                    data-testid={`footer-anchor-${a.href.replace('#', '')}`}
                    className={ENLACE}
                  >
                    {a.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-white">
              Se juega de todo
            </h2>
            <ul className="mt-3 space-y-2">
              {MODALIDADES.map((m) => (
                <li key={m} className="flex items-start gap-2 text-sm text-white/60">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-turf" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/55 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} App Futbol · Organizá, jugá, mejorá.</p>
          <p>Videos: Mixkit — licencia gratuita.</p>
        </div>
      </div>
    </footer>
  );
}
