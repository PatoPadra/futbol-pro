import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** Anclas a secciones que existen en esta misma página. Nada de links a páginas fantasma. */
const SECCIONES = [
  { href: '#asi-se-juega', label: 'Así se juega' },
  { href: '#funciones', label: 'Funciones' },
  { href: '#como-funciona', label: 'Cómo funciona' },
];

/**
 * Nav de la landing: arranca transparente encima del video del hero y se pasa a
 * vidrio en cuanto el usuario scrollea. Va fixed (no sticky) justamente para
 * poder flotar sobre el hero sin ocupar lugar en el layout.
 */
export default function LandingNav() {
  const [scrolleado, setScrolleado] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolleado(window.scrollY > 24);
    // Lo corremos una vez: el navegador puede restaurar la posición de scroll
    // y en ese caso el nav tiene que nacer en vidrio, no transparente.
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const anillo = scrolleado
    ? 'focus-visible:ring-turf focus-visible:ring-offset-white'
    : 'focus-visible:ring-white focus-visible:ring-offset-slate-950';

  return (
    <header
      data-testid="landing-nav"
      className={cn(
        'fixed inset-x-0 top-0 z-50 h-16 transition-all duration-300 motion-reduce:transition-none',
        scrolleado
          ? 'glass shadow-lift'
          : 'bg-gradient-to-b from-slate-950/70 via-slate-950/30 to-transparent',
      )}
    >
      <nav className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4">
        <Link
          to="/"
          data-testid="landing-nav-logo"
          className={cn(
            'flex items-center gap-2 rounded-lg px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            anillo,
          )}
        >
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl bg-turf transition-shadow duration-300 motion-reduce:transition-none',
              scrolleado ? 'shadow-sm' : 'shadow-lift-turf',
            )}
          >
            <Trophy className="h-4 w-4 text-white" aria-hidden="true" />
          </span>
          <span
            className={cn(
              'font-heading text-lg font-bold uppercase tracking-tight transition-colors duration-300 motion-reduce:transition-none',
              scrolleado ? 'text-slate-900' : 'text-white',
            )}
          >
            App Futbol
          </span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {SECCIONES.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                data-testid={`landing-nav-link-${s.href.replace('#', '')}`}
                className={cn(
                  'flex h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none',
                  anillo,
                  scrolleado
                    ? 'text-slate-600 hover:bg-slate-900/5 hover:text-turf-accessible'
                    : 'text-white/85 hover:bg-white/10 hover:text-white',
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            data-testid="landing-nav-login"
            className={cn(
              'font-semibold focus-visible:ring-2 focus-visible:ring-offset-2',
              anillo,
              scrolleado
                ? 'text-slate-700 hover:bg-slate-900/5 hover:text-turf-accessible'
                : 'text-white hover:bg-white/10 hover:text-white',
            )}
          >
            <Link to="/login">Ya tengo cuenta</Link>
          </Button>
          <Button
            asChild
            shape="pill"
            data-testid="landing-nav-register"
            className={cn(
              'hidden bg-turf px-6 text-white hover:bg-turf-dark sm:inline-flex focus-visible:ring-2 focus-visible:ring-offset-2',
              anillo,
            )}
          >
            <Link to="/registro">Crear cuenta</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
