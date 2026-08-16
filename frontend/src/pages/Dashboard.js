import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { AlertCircle, ArrowRight, CalendarClock, History, RefreshCw } from 'lucide-react';

import Reveal from '@/components/common/Reveal';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import EmptyMatchesCard from '@/components/dashboard/EmptyMatchesCard';
import MatchCard from '@/components/dashboard/MatchCard';
import RecentMatchRow from '@/components/dashboard/RecentMatchRow';
import StatTiles from '@/components/dashboard/StatTiles';
import WelcomeBanner from '@/components/dashboard/WelcomeBanner';
import { PRIMARY_CTA } from '@/components/dashboard/tokens';

/**
 * En mobile la tira de próximos partidos es un carrusel con snap (se arrastra con
 * el dedo); en desktop la misma lista se acomoda como grilla. Un solo DOM: si
 * duplicáramos el bloque por breakpoint, cada `match-card-{id}` aparecería dos
 * veces.
 */
const MATCH_RAIL =
  '-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 pt-1 ' +
  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ' +
  'md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3';

const SECTION_LINK =
  'flex items-center gap-1 rounded-md px-1 py-1 -mx-1 text-sm font-semibold text-turf-accessible hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2';

function todayAndTomorrow() {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  return { today: today.toLocaleDateString('en-CA'), tomorrow: tomorrow.toLocaleDateString('en-CA') };
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (user && user.has_profile === false) {
      navigate('/completar-perfil');
      return;
    }
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setError(false);
    try {
      const [matchesRes, metricsRes] = await Promise.all([
        api.get('/matches'),
        api.get(`/players/${user?.profile_id || user?.profile?.id}/metrics`).catch(() => ({ data: null })),
      ]);
      setMatches(matchesRes.data || []);
      setMetrics(metricsRes.data);
    } catch (err) {
      console.error(err);
      setError(true);
      toast.error('No pudimos cargar tu panel. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setLoading(true);
    loadData();
  };

  const upcomingMatches = matches.filter(m => ['abierto', 'cerrado', 'equipos_generados', 'equipos_confirmados'].includes(m.status));
  const recentMatches = matches.filter(m => ['finalizado', 'completado', 'cancelado'].includes(m.status)).slice(0, 5);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="page-container" data-testid="dashboard-error">
        <div className="glass flex flex-col items-center justify-center rounded-3xl px-6 py-20 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-7 w-7 text-red-500" aria-hidden="true" />
          </div>
          <h2 className="mb-2 font-heading text-2xl font-bold uppercase tracking-tight text-slate-900">
            No pudimos cargar tu panel
          </h2>
          <p className="mb-6 max-w-sm text-slate-500">
            Revisá tu conexión a internet e intentá de nuevo.
          </p>
          <Button
            onClick={handleRetry}
            data-testid="dashboard-retry-btn"
            shape="pill"
            className={`${PRIMARY_CTA} h-11 px-8`}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const canCreateMatch = user?.role === 'organizador' || user?.role === 'admin';
  const goToCreateMatch = () => navigate('/partidos/crear');
  const { today, tomorrow } = todayAndTomorrow();

  return (
    <div className="page-container" data-testid="dashboard-page">
      <WelcomeBanner
        name={user?.profile?.name || user?.name || 'Jugador'}
        upcomingCount={upcomingMatches.length}
        canCreate={canCreateMatch}
        onCreateMatch={goToCreateMatch}
      />

      {metrics && (
        <Reveal from="up" delay={60} className="mb-8 block">
          <StatTiles metrics={metrics} />
        </Reveal>
      )}

      <Reveal as="section" from="up" delay={90} className="mb-8 block">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-turf/10 text-turf-accessible">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="font-heading text-xl font-bold uppercase tracking-tight md:text-2xl">
              Próximos Partidos
            </h2>
            {upcomingMatches.length > 0 && (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
                {upcomingMatches.length}
              </span>
            )}
          </div>
          <Link to="/partidos" className={SECTION_LINK} data-testid="see-all-matches">
            Ver todos <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {upcomingMatches.length === 0 ? (
          <EmptyMatchesCard canCreate={canCreateMatch} onCreateMatch={goToCreateMatch} />
        ) : (
          <>
            <div className={MATCH_RAIL}>
              {upcomingMatches.slice(0, 6).map(m => (
                <div key={m.id} className="w-[84%] shrink-0 snap-start sm:w-[56%] md:w-auto">
                  <MatchCard
                    match={m}
                    dayTag={m.date === today ? 'Hoy' : m.date === tomorrow ? 'Mañana' : null}
                  />
                </div>
              ))}
            </div>
            {upcomingMatches.length > 1 && (
              <p className="mt-1 text-xs text-slate-500 md:hidden">Deslizá para ver los demás</p>
            )}
          </>
        )}
      </Reveal>

      {recentMatches.length > 0 && (
        <Reveal as="section" from="up" delay={60} className="block">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <History className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="font-heading text-xl font-bold uppercase tracking-tight md:text-2xl">
              Partidos Recientes
            </h2>
          </div>
          <div className="glass space-y-2.5 rounded-3xl p-2.5 shadow-lift md:p-3">
            {recentMatches.map(m => (
              <RecentMatchRow key={m.id} match={m} />
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}
