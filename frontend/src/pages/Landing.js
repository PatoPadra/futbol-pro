import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Trophy, Users, BarChart3, Zap, Shield, ClipboardCheck, ArrowRight } from 'lucide-react';

const MOCK_PLAYERS = [
  { top: '18%', left: '50%', label: 'PT' },
  { top: '38%', left: '22%', label: 'DEF' },
  { top: '38%', left: '50%', label: 'DEF' },
  { top: '38%', left: '78%', label: 'DEF' },
  { top: '62%', left: '35%', label: 'MED' },
  { top: '62%', left: '65%', label: 'MED' },
  { top: '85%', left: '50%', label: 'DEL' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white" data-testid="landing-page">
      {/* Sticky nav (visible once you scroll past the hero) */}
      <header className="hidden md:flex sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-40 h-16 items-center px-6">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="landing-nav-logo">
            <div className="w-8 h-8 bg-turf rounded-lg flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading text-lg font-bold uppercase tracking-tight text-slate-900">App Futbol</span>
          </Link>
          <Button asChild variant="ghost" data-testid="landing-nav-login">
            <Link to="/login">Ya tengo cuenta</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-turf to-turf-dark" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url(https://images.unsplash.com/photo-1745012010615-47abbeb3e906?w=1200&q=60)`,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-20 md:py-32">
          <div className="max-w-2xl">
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-white uppercase tracking-tight leading-tight animate-slide-up"
              data-testid="hero-title">
              Organizá tus partidos como un profesional
            </h1>
            <p className="mt-4 text-lg md:text-xl text-white/90 leading-relaxed max-w-xl animate-slide-up"
              style={{ animationDelay: '100ms' }}>
              Creá partidos, armá equipos balanceados automáticamente y llevá el historial de rendimiento de cada jugador.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <Button
                asChild
                data-testid="hero-register-btn"
                className="bg-white text-turf-accessible hover:bg-white/90 rounded-full px-8 py-6 text-base font-bold uppercase tracking-wider shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-turf-dark"
              >
                <Link to="/registro">
                  Comenzar Gratis <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                data-testid="hero-login-btn"
                className="border-2 border-white/40 text-white hover:bg-white/10 rounded-full px-8 py-6 text-base font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-turf-dark"
              >
                <Link to="/login">Ya tengo cuenta</Link>
              </Button>
            </div>
          </div>
        </div>
        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full">
            <path d="M0 60V20C360 0 720 40 1080 20C1260 10 1380 15 1440 20V60H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-center uppercase tracking-tight text-slate-900">
            Todo lo que necesitas
          </h2>
          <p className="mt-3 text-center text-slate-500 max-w-xl mx-auto">
            Desde fútbol 5 hasta fútbol 11, con formaciones tácticas y balance automático.
          </p>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: Zap, title: 'Equipos Balanceados', desc: 'Algoritmo inteligente que arma dos equipos equilibrados según nivel, posiciones y formación.', hero: true },
              { icon: Users, title: 'Gestiona Jugadores', desc: 'Registrá jugadores frecuentes e invitados con posiciones preferidas, fotos y nivel de juego.' },
              { icon: BarChart3, title: 'Historial y Rating', desc: 'Seguimiento de rendimiento con evaluaciones de compañeros, estadísticas y evolución.' },
              { icon: Trophy, title: 'Formaciones Tácticas', desc: 'Visualizá formaciones en una canchita interactiva para fútbol 11. 4-4-2, 4-3-3 y más.', hero: true },
              { icon: Shield, title: 'Roles y Permisos', desc: 'Admins, organizadores y jugadores con diferentes niveles de acceso.' },
              { icon: ClipboardCheck, title: 'Post Partido', desc: 'Evaluaciones cruzadas, estadísticas confirmadas por votación y actualización automática de ratings.' },
            ].map((f, i) => (
              <div
                key={i}
                data-testid={`feature-card-${i}`}
                className={`bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 p-6 hover:-translate-y-1 cursor-default ${f.hero ? 'md:col-span-2' : 'md:col-span-1'}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className={`rounded-xl bg-turf/10 flex items-center justify-center mb-4 ${f.hero ? 'w-12 h-12' : 'w-11 h-11'}`}>
                  <f.icon className={f.hero ? 'w-6 h-6 text-turf-accessible' : 'w-5 h-5 text-turf-accessible'} />
                </div>
                <h3 className="font-heading text-xl font-bold uppercase tracking-tight text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section className="py-16 md:py-20 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight text-slate-900">
              Vas a ver la formación antes de pisar la cancha
            </h2>
            <p className="mt-3 text-slate-500 leading-relaxed">
              Una vez cerrada la inscripción, generamos dos equipos equilibrados y los mostramos sobre una cancha
              táctica: quién juega dónde, con foto y todo, para que no haya sorpresas el día del partido.
            </p>
          </div>
          <div
            className="relative bg-pitch rounded-xl overflow-hidden border-4 border-white/20 shadow-inner aspect-[3/2]"
            data-testid="landing-pitch-preview"
          >
            <div className="absolute inset-0">
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/30" />
              <div className="absolute left-1/2 top-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2 border-2 border-white/30 rounded-full" />
              <div className="absolute inset-2 border-2 border-white/30 rounded-lg" />
            </div>
            {MOCK_PLAYERS.map((p, i) => (
              <div
                key={i}
                className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 border-2 border-slate-900 shadow flex items-center justify-center text-[8px] font-bold text-slate-700"
                style={{ top: p.top, left: p.left }}
              >
                {p.label}
              </div>
            ))}
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/50 text-white text-xs font-bold">
              4-3-3
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">
            ¿Listo para armar tu próximo partido?
          </h2>
          <p className="mt-3 text-slate-400 max-w-lg mx-auto">
            Registrate gratis y empezá a organizar partidos con equipos equilibrados.
          </p>
          <Button
            asChild
            data-testid="cta-register-btn"
            className="mt-8 bg-turf hover:bg-turf-dark text-white rounded-full px-10 py-6 text-base font-bold uppercase tracking-wider shadow-lg shadow-turf/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <Link to="/registro">
              Crear mi cuenta <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-slate-100" data-testid="landing-footer">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
            data-testid="footer-logo-link"
          >
            <div className="w-6 h-6 bg-turf rounded flex items-center justify-center">
              <Trophy className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-heading font-bold uppercase text-slate-600">App Futbol</span>
          </Link>
          <p>Organizá, jugá, mejorá.</p>
        </div>
      </footer>
    </div>
  );
}
