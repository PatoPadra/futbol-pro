import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Home,
  LogOut,
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
import { getDisplayName } from '../utils/user';
import { isOrganizerRole } from '../utils/permissions';

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
    <div className="min-h-screen bg-background">
      <header className="hidden md:flex sticky top-0 bg-white/85 backdrop-blur-md border-b border-slate-100 z-40 h-16 items-center px-6">
        <Link to="/dashboard" className="flex items-center gap-2 mr-8" data-testid="nav-logo">
          <div className="w-9 h-9 bg-turf rounded-xl flex items-center justify-center shadow-sm shadow-turf/20">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-heading text-xl font-bold uppercase tracking-tight text-slate-900 block leading-none">
              App Futbol
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Organizá mejor cada fecha</span>
          </div>
        </Link>

        <nav className="flex items-center gap-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-turf/10 text-turf-accessible'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <item.icon className="w-4 h-4" />
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
                className="rounded-full px-5 h-9 text-sm font-bold uppercase tracking-wider"
              >
                <Users className="w-4 h-4 mr-1" /> Crear grupo
              </Button>
              <Button
                data-testid="create-match-btn"
                onClick={() => navigate('/partidos/crear')}
                className="bg-turf hover:bg-turf-dark text-white rounded-full px-5 h-9 text-sm font-bold uppercase tracking-wider"
              >
                <Plus className="w-4 h-4 mr-1" /> Crear partido
              </Button>
            </>
          )}
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span className="font-medium text-slate-900">{displayName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            data-testid="logout-btn"
            className="text-slate-500 hover:text-red-600 rounded-full"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <header className="md:hidden sticky top-0 bg-white/90 backdrop-blur-lg border-b border-slate-200 z-40 h-14 flex items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2" data-testid="mobile-nav-logo">
          <div className="w-8 h-8 bg-turf rounded-xl flex items-center justify-center shadow-sm shadow-turf/20">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-heading text-lg font-bold uppercase tracking-tight block leading-none">App Futbol</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Fecha lista</span>
          </div>
        </Link>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 text-slate-600"
          data-testid="mobile-menu-toggle"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {menuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 bg-white/95 backdrop-blur-lg border-b border-slate-200 z-30 p-4 animate-slide-up">
          <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 mb-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Sesión activa</p>
            <p className="font-medium text-slate-900 mt-1">{displayName}</p>
          </div>

          <div className="flex flex-col gap-1">
            {isOrganizerRole(user) && (
              <>
                <button
                  onClick={() => { navigate('/grupos/crear'); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 text-sm hover:bg-slate-50"
                  data-testid="mobile-create-group"
                >
                  <Users className="w-4 h-4" /> Crear grupo
                </button>
                <button
                  onClick={() => { navigate('/partidos/crear'); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-turf-accessible font-semibold text-sm bg-turf/5"
                  data-testid="mobile-create-match"
                >
                  <Plus className="w-4 h-4" /> Crear partido
                </button>
              </>
            )}
            <button
              onClick={() => { navigate('/invitar-jugador'); setMenuOpen(false); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 text-sm hover:bg-slate-50"
              data-testid="mobile-invite-guest"
            >
              <Users className="w-4 h-4" /> Invitar jugador
            </button>
            <hr className="my-2" />
            <button
              onClick={() => { handleLogout(); setMenuOpen(false); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 text-sm"
              data-testid="mobile-logout"
            >
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <main className="pb-20 md:pb-8">{children}</main>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 h-16 flex items-center justify-around z-50 pb-safe"
        data-testid="mobile-bottom-nav"
      >
        {navItems.slice(0, 5).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
              isActive(item.path) ? 'text-turf-accessible' : 'text-slate-400'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
