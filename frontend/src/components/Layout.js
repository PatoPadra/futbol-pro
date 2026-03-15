import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Home, Trophy, UserCircle, Plus, Shield, ClipboardList,
  LogOut, Menu, X, Users
} from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';

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

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Nav */}
      <header className="hidden md:flex sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-40 h-16 items-center px-6">
        <Link to="/dashboard" className="flex items-center gap-2 mr-8" data-testid="nav-logo">
          <div className="w-8 h-8 bg-turf rounded-lg flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading text-xl font-bold uppercase tracking-tight text-slate-900">
            App Futbol
          </span>
        </Link>

        <nav className="flex items-center gap-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-turf/10 text-turf'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {(user?.role === 'organizador' || user?.role === 'admin') && (
            <Button
              data-testid="create-match-btn"
              onClick={() => navigate('/partidos/crear')}
              className="bg-turf hover:bg-turf-dark text-white rounded-full px-5 h-9 text-sm font-bold uppercase tracking-wider"
            >
              <Plus className="w-4 h-4 mr-1" /> Crear Partido
            </Button>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">{user?.profile?.name || user?.name || ''}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            data-testid="logout-btn"
            className="text-slate-500 hover:text-red-600"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 bg-white/90 backdrop-blur-lg border-b border-slate-200 z-40 h-14 flex items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2" data-testid="mobile-nav-logo">
          <div className="w-7 h-7 bg-turf rounded-lg flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <span className="font-heading text-lg font-bold uppercase tracking-tight">App Futbol</span>
        </Link>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 text-slate-600"
          data-testid="mobile-menu-toggle"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 bg-white/95 backdrop-blur-lg border-b border-slate-200 z-30 p-4 animate-slide-up">
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 mb-2">
              {user?.profile?.name || user?.name}
            </div>
            {(user?.role === 'organizador' || user?.role === 'admin') && (
              <button
                onClick={() => { navigate('/partidos/crear'); setMenuOpen(false); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-turf font-semibold text-sm bg-turf/5"
                data-testid="mobile-create-match"
              >
                <Plus className="w-4 h-4" /> Crear Partido
              </button>
            )}
            <button
              onClick={() => { navigate('/invitar-jugador'); setMenuOpen(false); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 text-sm hover:bg-slate-50"
              data-testid="mobile-invite-guest"
            >
              <Users className="w-4 h-4" /> Invitar Jugador
            </button>
            <hr className="my-2" />
            <button
              onClick={() => { handleLogout(); setMenuOpen(false); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 text-sm"
              data-testid="mobile-logout"
            >
              <LogOut className="w-4 h-4" /> Cerrar Sesion
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="pb-20 md:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 h-16 flex items-center justify-around z-50 pb-safe"
        data-testid="mobile-bottom-nav">
        {navItems.slice(0, 5).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
              isActive(item.path)
                ? 'text-turf'
                : 'text-slate-400'
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
