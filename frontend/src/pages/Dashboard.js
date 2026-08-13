import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Calendar, MapPin, Users, Trophy, ArrowRight, Clock, Plus, Star, AlertCircle, RefreshCw } from 'lucide-react';

import { MATCH_STATUS_BADGE_CLASS, MATCH_STATUS_LABELS, MODALITY_LABELS } from '@/constants/matches';

const PRIMARY_CTA = 'bg-turf hover:bg-turf-dark text-white rounded-full font-bold uppercase tracking-wider transition-transform active:scale-95 shadow-lg shadow-turf/20 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2';
const CARD_LINK_FOCUS = 'block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2';

function DashboardSkeleton() {
  return (
    <div className="page-container" data-testid="dashboard-skeleton">
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="h-9 w-56 bg-slate-200 rounded-lg" />
            <div className="h-4 w-40 bg-slate-100 rounded" />
          </div>
          <div className="hidden md:block h-11 w-44 bg-slate-200 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[72px] bg-slate-100 rounded-xl border border-slate-100" />
          ))}
        </div>
        <div className="h-6 w-48 bg-slate-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 bg-slate-100 rounded-xl border border-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
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
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="font-heading text-2xl font-bold uppercase tracking-tight text-slate-900 mb-2">
            No pudimos cargar tu panel
          </h2>
          <p className="text-slate-500 mb-6 max-w-sm">
            Revisá tu conexión a internet e intentá de nuevo.
          </p>
          <Button
            onClick={handleRetry}
            data-testid="dashboard-retry-btn"
            className={`${PRIMARY_CTA} h-11 px-8`}
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" data-testid="dashboard-page">
      <div className="animate-slide-up">
        {/* Welcome */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold uppercase tracking-tight">
              Hola, {user?.profile?.name || user?.name || 'Jugador'}
            </h1>
            <p className="mt-1 text-slate-500">
              {upcomingMatches.length > 0
                ? `Tenés ${upcomingMatches.length} partido${upcomingMatches.length > 1 ? 's' : ''} próximo${upcomingMatches.length > 1 ? 's' : ''}`
                : 'No hay partidos próximos. ¡Buen momento para organizar uno!'}
            </p>
          </div>
          {(user?.role === 'organizador' || user?.role === 'admin') && (
            <Button
              data-testid="dashboard-create-match"
              onClick={() => navigate('/partidos/crear')}
              className={`hidden md:flex h-11 px-6 ${PRIMARY_CTA}`}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Crear Partido
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        {metrics && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[
                { label: 'Partidos', value: metrics.total_matches ?? 0, icon: Trophy },
                ...(metrics.can_view_peer_scores ? [{ label: 'Rating', value: metrics.recent_rating?.toFixed(1) || '-', icon: Star }] : []),
                { label: 'Goles', value: metrics.total_goals ?? 0, icon: () => <span className="text-lg">G</span> },
                { label: 'Asistencias', value: metrics.total_assists ?? 0, icon: () => <span className="text-lg">A</span> },
              ].map((s, i) => (
                <Card key={i} className="border-slate-100" data-testid={`dashboard-stat-${s.label.toLowerCase()}`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-turf/10 flex items-center justify-center shrink-0">
                      <s.icon className="w-5 h-5 text-turf-accessible" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                      <p className="text-xs text-slate-500 uppercase tracking-wider truncate">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-xs text-slate-500 mb-8">
              {!metrics.can_view_peer_scores && 'Los puntajes internos quedan visibles solo para organizadores y admins.'}
            </p>
          </>
        )}

        {/* Upcoming Matches */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl md:text-2xl font-bold uppercase tracking-tight">Próximos Partidos</h2>
            <Link
              to="/partidos"
              className="text-sm text-turf-accessible font-semibold flex items-center gap-1 hover:underline rounded-md px-1 py-1 -mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
              data-testid="see-all-matches"
            >
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {upcomingMatches.length === 0 ? (
            <Card className="border-slate-100 border-dashed">
              <CardContent className="p-8 text-center">
                <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No hay partidos próximos</p>
                {(user?.role === 'organizador' || user?.role === 'admin') && (
                  <Button
                    onClick={() => navigate('/partidos/crear')}
                    className={`mt-4 h-11 px-8 ${PRIMARY_CTA}`}
                    data-testid="empty-create-match"
                  >
                    Crear Partido
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingMatches.slice(0, 6).map(m => {
                const spotsLeft = m.max_players - m.titular_count;
                const isFull = spotsLeft <= 0;
                return (
                  <Link to={`/partidos/${m.id}`} key={m.id} data-testid={`match-card-${m.id}`} className={CARD_LINK_FOCUS}>
                    <Card className="border-slate-100 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 active:scale-[0.98] cursor-pointer h-full">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <Badge className={`text-xs font-semibold border ${MATCH_STATUS_BADGE_CLASS[m.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {MATCH_STATUS_LABELS[m.status] || m.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{MODALITY_LABELS[m.modality]}</Badge>
                        </div>
                        <h3 className="font-heading text-lg font-bold uppercase tracking-tight text-slate-900 mb-3">{m.title}</h3>
                        <div className="space-y-1.5 text-sm text-slate-500">
                          <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 shrink-0" /> {m.date}</div>
                          <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 shrink-0" /> {m.time}</div>
                          <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{m.location}</span></div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            <span className={isFull ? 'font-semibold text-slate-700' : ''}>{m.titular_count}/{m.max_players} titulares</span>
                            {isFull ? (
                              <Badge className="text-[10px] px-1.5 py-0 bg-slate-900 text-white border-0">Completo</Badge>
                            ) : (
                              <span className="text-slate-400">· {spotsLeft} {spotsLeft === 1 ? 'lugar libre' : 'lugares libres'}</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Matches */}
        {recentMatches.length > 0 && (
          <section>
            <h2 className="font-heading text-xl md:text-2xl font-bold uppercase tracking-tight mb-4">Partidos Recientes</h2>
            <div className="space-y-3">
              {recentMatches.map(m => (
                <Link to={`/partidos/${m.id}`} key={m.id} data-testid={`recent-match-${m.id}`} className={CARD_LINK_FOCUS}>
                  <Card className="border-slate-100 hover:shadow-md transition-all duration-200 active:scale-[0.98] cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <Trophy className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{m.title}</p>
                          <p className="text-xs text-slate-500">{m.date} - {MODALITY_LABELS[m.modality]}</p>
                        </div>
                      </div>
                      <Badge className={`text-xs border shrink-0 ${MATCH_STATUS_BADGE_CLASS[m.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{MATCH_STATUS_LABELS[m.status] || m.status}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
