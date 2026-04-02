import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Calendar, MapPin, Users, Trophy, ArrowRight, Clock, Plus, Star } from 'lucide-react';

import { MATCH_STATUS_BADGE_CLASS, MATCH_STATUS_LABELS, MODALITY_LABELS } from '@/constants/matches';
import PageLoader from '@/components/common/PageLoader';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.has_profile === false) {
      navigate('/completar-perfil');
      return;
    }
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [matchesRes, metricsRes] = await Promise.all([
        api.get('/matches'),
        api.get(`/players/${user?.profile_id || user?.profile?.id}/metrics`).catch(() => ({ data: null })),
      ]);
      setMatches(matchesRes.data || []);
      setMetrics(metricsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const upcomingMatches = matches.filter(m => ['abierto', 'cerrado', 'equipos_generados', 'equipos_confirmados'].includes(m.status));
  const recentMatches = matches.filter(m => ['finalizado', 'completado', 'cancelado'].includes(m.status)).slice(0, 5);

  if (loading) return <PageLoader />;

  return (
    <div className="page-container" data-testid="dashboard-page">
      <div className="animate-slide-up">
        {/* Welcome */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">
              Hola, {user?.profile?.name || user?.name || 'Jugador'}
            </h1>
            <p className="mt-1 text-slate-500">
              {upcomingMatches.length > 0
                ? `Tenes ${upcomingMatches.length} partido${upcomingMatches.length > 1 ? 's' : ''} proximo${upcomingMatches.length > 1 ? 's' : ''}`
                : 'No hay partidos proximos'}
            </p>
          </div>
          {(user?.role === 'organizador' || user?.role === 'admin') && (
            <Button
              data-testid="dashboard-create-match"
              onClick={() => navigate('/partidos/crear')}
              className="hidden md:flex bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase tracking-wider"
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
                { label: 'Partidos', value: metrics.total_matches, icon: Trophy },
                ...(metrics.can_view_peer_scores ? [{ label: 'Rating', value: metrics.recent_rating?.toFixed(1) || '-', icon: Star }] : []),
                { label: 'Goles', value: metrics.total_goals, icon: () => <span className="text-lg">G</span> },
                { label: 'Asistencias', value: metrics.total_assists, icon: () => <span className="text-lg">A</span> },
              ].map((s, i) => (
                <Card key={i} className="border-slate-100">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-turf/10 flex items-center justify-center">
                      {typeof s.icon === 'function' ? <s.icon className="w-5 h-5 text-turf" /> : <s.icon className="w-5 h-5 text-turf" />}
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {!metrics.can_view_peer_scores && (
              <p className="text-xs text-slate-500 mb-8">
                Los puntajes internos quedan visibles solo para organizadores y admins.
              </p>
            )}
          </>
        )}

        {/* Upcoming Matches */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl md:text-2xl font-bold uppercase tracking-tight">Proximos Partidos</h2>
            <Link to="/partidos" className="text-sm text-turf font-semibold flex items-center gap-1 hover:underline" data-testid="see-all-matches">
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {upcomingMatches.length === 0 ? (
            <Card className="border-slate-100 border-dashed">
              <CardContent className="p-8 text-center">
                <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No hay partidos proximos</p>
                {(user?.role === 'organizador' || user?.role === 'admin') && (
                  <Button
                    onClick={() => navigate('/partidos/crear')}
                    className="mt-4 bg-turf hover:bg-turf-dark text-white rounded-full"
                    data-testid="empty-create-match"
                  >
                    Crear Partido
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingMatches.slice(0, 6).map(m => (
                <Link to={`/partidos/${m.id}`} key={m.id} data-testid={`match-card-${m.id}`}>
                  <Card className="border-slate-100 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <Badge className={`text-xs font-semibold border ${MATCH_STATUS_BADGE_CLASS[m.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {MATCH_STATUS_LABELS[m.status] || m.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{MODALITY_LABELS[m.modality]}</Badge>
                      </div>
                      <h3 className="font-heading text-lg font-bold uppercase tracking-tight text-slate-900 mb-3">{m.title}</h3>
                      <div className="space-y-1.5 text-sm text-slate-500">
                        <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {m.date}</div>
                        <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {m.time}</div>
                        <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {m.location}</div>
                        <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5" /> {m.titular_count}/{m.max_players} titulares</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recent Matches */}
        {recentMatches.length > 0 && (
          <section>
            <h2 className="font-heading text-xl md:text-2xl font-bold uppercase tracking-tight mb-4">Partidos Recientes</h2>
            <div className="space-y-3">
              {recentMatches.map(m => (
                <Link to={`/partidos/${m.id}`} key={m.id} data-testid={`recent-match-${m.id}`}>
                  <Card className="border-slate-100 hover:shadow-sm transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{m.title}</p>
                          <p className="text-xs text-slate-500">{m.date} - {MODALITY_LABELS[m.modality]}</p>
                        </div>
                      </div>
                      <Badge className={`text-xs border ${MATCH_STATUS_BADGE_CLASS[m.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{MATCH_STATUS_LABELS[m.status] || m.status}</Badge>
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
