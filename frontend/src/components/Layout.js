import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Home,
  LogOut,
  Medal,
  Menu,
  Plus,
  Shield,
  Trophy,
  UserCircle,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getDisplayName } from '../utils/user';
import { isOrganizerRole } from '../utils/permissions';
import { buildPhotoUrl, initialsFromName } from '../utils/photos';
import PageBackdrop from './media/PageBackdrop';

/** Foco visible para links y botones propios del shell (guía de accesibilidad). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2';

export default function Layout({ children }) {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Inicio' },
    { path: '/partidos', icon: Trophy, label: 'Partidos' },
    // Torneos va acá y no atrás de "Organizar": lo mira todo el mundo que juega
    // uno, no sólo quien lo administra.
    { path: '/torneos', icon: Medal, label: 'Torneos' },
    { path: '/mi-perfil', icon: UserCircle, label: 'Perfil' },
  ];

  if (user?.role === 'organizador' || user?.role === 'admin') {
    navItems.splice(2, 0, { path: '/organizador', icon: ClipboardList, label: 'Organizar' });
  }
  if (user?.role === 'admin') {
    navItems.push({ path: '/admin', icon: Shield, label: 'Admin' });
  }

  if (!isAuthenticated) {
    return <main className="min-h-screen">{children}</main>;
  }

  const displayName = getDisplayName(user);

  return (
    <div className="min-h-screen">
      {/* El fondo de la app: la foto de la pagina, desenfocada detras de un velo
          claro. El contenedor no lleva fondo propio a proposito — un bg opaco
          aca taparia el backdrop, que va en -z-10. */}
      <PageBackdrop pathname={location.pathname} />
      <header className="glass sticky top-0 z-40 hidden h-16 items-center px-6 shadow-sm md:flex">
        {/* Hairline de acento: hace de separador y mete el color de marca. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-turf/70 via-orange/40 to-transparent"
        />

        <Link to="/dashboard" className={`mr-8 flex items-center gap-2 rounded-xl ${FOCUS_RING}`} data-testid="nav-logo">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-hero-turf shadow-sm shadow-turf/30 ring-1 ring-white/40">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="block font-heading text-xl font-bold uppercase leading-none tracking-tight text-slate-900">
              App Futbol
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Organizá mejor cada fecha</span>
          </div>
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              aria-current={isActive(item.path) ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
                isActive(item.path)
                  ? 'bg-turf/15 text-turf-accessible shadow-sm ring-1 ring-turf/25'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {isOrganizerRole(user) && (
            <>
              <Button
                data-testid="create-group-btn"
                variant="outline"
                onClick={() => navigate('/grupos/crear')}
                className="h-9 rounded-full bg-white/70 px-5 text-sm font-bold uppercase tracking-wider"
              >
                <Users className="mr-1 h-4 w-4" /> Crear grupo
              </Button>
              <Button
                data-testid="create-tournament-nav-btn"
                variant="outline"
                onClick={() => navigate('/torneos/crear')}
                className="h-9 rounded-full bg-white/70 px-5 text-sm font-bold uppercase tracking-wider"
              >
                <Medal className="mr-1 h-4 w-4" /> Crear torneo
              </Button>
              <Button
                data-testid="create-match-btn"
                onClick={() => navigate('/partidos/crear')}
                className="h-9 rounded-full bg-turf px-5 text-sm font-bold uppercase tracking-wider text-white shadow-sm shadow-turf/30 hover:bg-turf-dark"
              >
                <Plus className="mr-1 h-4 w-4" /> Crear partido
              </Button>
            </>
          )}
          <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 py-1.5 pl-1.5 pr-3 text-sm text-slate-600">
            <Avatar className="h-6 w-6">
              <AvatarImage src={buildPhotoUrl(user?.profile?.photo_url) || undefined} />
              <AvatarFallback className="bg-turf/10 text-[10px] font-bold text-turf-accessible">
                {initialsFromName(displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-slate-900">{displayName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            data-testid="logout-btn"
            aria-label="Cerrar sesión"
            className="rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <header className="glass sticky top-0 z-40 flex h-14 items-center justify-between px-4 shadow-sm md:hidden">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-turf/70 via-orange/40 to-transparent"
        />

        <Link to="/dashboard" className={`flex items-center gap-2 rounded-xl ${FOCUS_RING}`} data-testid="mobile-nav-logo">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-hero-turf shadow-sm shadow-turf/30 ring-1 ring-white/40">
            <Trophy className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="block font-heading text-lg font-bold uppercase leading-none tracking-tight">App Futbol</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Fecha lista</span>
          </div>
        </Link>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-white/70 ${FOCUS_RING}`}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          data-testid="mobile-menu-toggle"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {menuOpen && (
        <div className="glass animate-slide-up fixed inset-x-0 top-14 z-30 rounded-b-3xl p-4 shadow-lift motion-reduce:animate-none md:hidden">
          <div className="mb-3 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sesión activa</p>
            <p className="mt-1 font-medium text-slate-900">{displayName}</p>
          </div>

          <div className="flex flex-col gap-1">
            {isOrganizerRole(user) && (
              <>
                <button
                  onClick={() => { navigate('/grupos/crear'); setMenuOpen(false); }}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-slate-700 hover:bg-white/70 ${FOCUS_RING}`}
                  data-testid="mobile-create-group"
                >
                  <Users className="h-4 w-4" /> Crear grupo
                </button>
                <button
                  onClick={() => { navigate('/torneos/crear'); setMenuOpen(false); }}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-slate-700 hover:bg-white/70 ${FOCUS_RING}`}
                  data-testid="mobile-create-tournament"
                >
                  <Medal className="h-4 w-4" /> Crear torneo
                </button>
                <button
                  onClick={() => { navigate('/partidos/crear'); setMenuOpen(false); }}
                  className={`flex min-h-11 items-center gap-3 rounded-xl bg-turf/10 px-3 text-sm font-semibold text-turf-accessible ring-1 ring-turf/20 ${FOCUS_RING}`}
                  data-testid="mobile-create-match"
                >
                  <Plus className="h-4 w-4" /> Crear partido
                </button>
              </>
            )}
            <button
              onClick={() => { navigate('/invitar-jugador'); setMenuOpen(false); }}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-slate-700 hover:bg-white/70 ${FOCUS_RING}`}
              data-testid="mobile-invite-guest"
            >
              <Users className="h-4 w-4" /> Invitar jugador
            </button>
            <hr className="my-2 border-slate-200/70" />
            <button
              onClick={() => { handleLogout(); setMenuOpen(false); }}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-red-600 hover:bg-red-50 ${FOCUS_RING}`}
              data-testid="mobile-logout"
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <main className="pb-20 md:pb-8">{children}</main>

      <nav
        className="glass pb-safe fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-slate-200/80 md:hidden"
        data-testid="mobile-bottom-nav"
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-turf/60 to-transparent"
        />

        {/* El corte era 5 porque un admin llegaba justo a 5 ítems. Al sumar
            "Torneos" pasó a 6 y el que se caía era "Admin", que además no está
            en el menú hamburguesa: dejaba /admin sin ninguna entrada visible en
            celular. Se corta en 6, que es el máximo que arma este array. */}
        {navItems.slice(0, 6).map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
                active ? 'text-turf-accessible' : 'text-slate-500'
              }`}
            >
              {/* Indicador del activo: barra arriba + píldora detrás del ícono.
                  El color no es la única señal. */}
              {active && (
                <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-turf" />
              )}
              <span
                className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors motion-reduce:transition-none ${
                  active ? 'bg-turf/15' : ''
                }`}
              >
                <item.icon className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-semibold leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
