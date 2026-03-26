import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Clock, MapPin, Plus, Star, Trophy, Users } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import PageLoader from '../components/common/PageLoader';
import { MATCH_STATUS_LABELS, MATCH_STATUS_STYLES, MODALITY_LABELS, PAST_MATCH_STATUSES, UPCOMING_MATCH_STATUSES } from '../constants/matches';
import { getDisplayName } from '../utils/user';
import { isOrganizerRole } from '../utils/permissions';

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

  const upcomingMatches = useMemo(
    () => matches.filter((match) => UPCOMING_MATCH_STATUSES.includes(match.status)),
    [matches]
  );
  const recentMatches = useMemo(
    () => matches.filter((match) => PAST_MATCH_STATUSES.includes(match.status)).slice(0, 5),
    [matches]
  );
  const nextMatch = upcomingMatches[0] || null;
  const pendingPostMatch = matches.filter((match) => match.status === 'finalizado').length;

  if (loading) return <PageLoader label="Armando tu panel..." />;

  return (
    <div className="page-container" data-testid="dashboard-page">
      <div className="animate-slide-up space-y-8">
        <section className="rounded-[28px] border border-slate-100 bg-white px-6 py-7 md:px-8 shadow-sm shadow-slate-100/80 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-turf via-orange to-slate-900" />
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 mb-2">Panel principal</p>
              <h1 className="font-heading text-3xl md:text-5xl font-bold uppercase tracking-tight text-slate-900">
                Hola, {getDisplayName(user)}
              </h1>
              <p className="mt-3 text-slate-500 max-w-2xl leading-relaxed">
                {nextMatch
                  ? `Tu próxima cita es ${nextMatch.title} el ${nextMatch.date} a las ${nextMatch.time}.`
                  : 'Todavía no tenés un próximo partido cargado.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/partidos">
                <Button variant="outline" className="rounded-full px-5">Ver partidos</Button>
              </Link>
              {isOrganizerRole(user) && (
                <Button
                  data-testid="dashboard-create-match"
                  onClick={() => navigate('/partidos/crear')}
                  className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Crear partido
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Próximos partidos', value: upcomingMatches.length, icon: Calendar },
              { label: 'Pendientes post-partido', value: pendingPostMatch, icon: Users },
              { label: 'Rating reciente', value: metrics?.recent_rating?.toFixed(1) || '-', icon: Star },
              { label: 'Partidos jugados', value: metrics?.total_matches ?? 0, icon: Trophy },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center mb-3">
                  <item.icon className="w-5 h-5 text-turf" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {nextMatch && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl md:text-2xl font-bold uppercase tracking-tight">Tu próximo partido</h2>
              <Link to={`/partidos/${nextMatch.id}`} className="text-sm text-turf font-semibold flex items-center gap-1 hover:underline">
                Abrir detalle <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <Link to={`/partidos/${nextMatch.id}`} data-testid={`match-card-${nextMatch.id}`}>
              <Card className="border-slate-100 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge className={`text-xs font-semibold border ${MATCH_STATUS_STYLES[nextMatch.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {MATCH_STATUS_LABELS[nextMatch.status] || nextMatch.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{MODALITY_LABELS[nextMatch.modality]}</Badge>
                        {nextMatch.group_name && <Badge variant="outline" className="text-xs">{nextMatch.group_name}</Badge>}
                      </div>
                      <h3 className="font-heading text-2xl font-bold uppercase tracking-tight text-slate-900">{nextMatch.title}</h3>
                      <p className="text-sm text-slate-500 mt-1">Organiza {nextMatch.organizer_name}</p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-0 lg:min-w-[520px]">
                      {[
                        [Calendar, nextMatch.date],
                        [Clock, nextMatch.time],
                        [MapPin, nextMatch.location],
                        [Users, `${nextMatch.titular_count}/${nextMatch.max_players} titulares`],
                      ].map(([Icon, label]) => (
                        <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                          <Icon className="w-4 h-4 text-slate-400 mb-2" />
                          <p className="font-medium text-slate-900 truncate">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl md:text-2xl font-bold uppercase tracking-tight">Próximos partidos</h2>
            <Link to="/partidos" className="text-sm text-turf font-semibold flex items-center gap-1 hover:underline" data-testid="see-all-matches">
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {upcomingMatches.length === 0 ? (
            <Card className="border-slate-100 border-dashed">
              <CardContent className="p-8 text-center">
                <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No hay partidos próximos</p>
                {isOrganizerRole(user) && (
                  <Button
                    onClick={() => navigate('/partidos/crear')}
                    className="mt-4 bg-turf hover:bg-turf-dark text-white rounded-full"
                    data-testid="empty-create-match"
                  >
                    Crear partido
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {upcomingMatches.slice(0, 6).map((match) => (
                <Link to={`/partidos/${match.id}`} key={match.id}>
                  <Card className="border-slate-100 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <Badge className={`text-xs font-semibold border ${MATCH_STATUS_STYLES[match.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {MATCH_STATUS_LABELS[match.status] || match.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{MODALITY_LABELS[match.modality]}</Badge>
                      </div>
                      <h3 className="font-heading text-lg font-bold uppercase tracking-tight text-slate-900 mb-1">{match.title}</h3>
                      {match.group_name && <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Grupo: {match.group_name}</p>}
                      <div className="space-y-1.5 text-sm text-slate-500">
                        <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {match.date}</div>
                        <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {match.time}</div>
                        <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {match.location}</div>
                        <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5" /> {match.titular_count}/{match.max_players} titulares</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {recentMatches.length > 0 && (
          <section>
            <h2 className="font-heading text-xl md:text-2xl font-bold uppercase tracking-tight mb-4">Actividad reciente</h2>
            <div className="space-y-3">
              {recentMatches.map((match) => (
                <Link to={`/partidos/${match.id}`} key={match.id} data-testid={`recent-match-${match.id}`}>
                  <Card className="border-slate-100 hover:shadow-sm transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                          <Trophy className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{match.title}</p>
                          <p className="text-xs text-slate-500 truncate">{match.date} · {MODALITY_LABELS[match.modality]}</p>
                        </div>
                      </div>
                      <Badge className={`text-xs border ${MATCH_STATUS_STYLES[match.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {MATCH_STATUS_LABELS[match.status] || match.status}
                      </Badge>
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
