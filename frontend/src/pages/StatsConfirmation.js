import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import PageLoader from '../components/common/PageLoader';
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, ClipboardList, Loader2, ThumbsUp, Target, Users, Hand } from 'lucide-react';
import { toast } from 'sonner';

export default function StatsConfirmation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [proposals, setProposals] = useState([]);
  const [finalStats, setFinalStats] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState('');

  const profileId = user?.profile_id || user?.profile?.id;

  const loadData = async () => {
    try {
      const [propRes, finalRes, regsRes] = await Promise.all([
        api.get(`/matches/${id}/stats/proposals`),
        api.get(`/matches/${id}/stats/final`),
        api.get(`/matches/${id}/registrations`).catch(() => ({ data: [] })),
      ]);
      setProposals(propRes.data || []);
      setFinalStats(finalRes.data || []);
      setRegistrations(regsRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo cargar el estado de las estadísticas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVote = async (proposalId) => {
    setVotingId(proposalId);
    try {
      const res = await api.post(`/matches/${id}/stats/vote`, { proposal_id: proposalId });
      toast.success(res.data.message);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al votar');
    } finally {
      setVotingId('');
    }
  };

  const confirmedPlayerIds = useMemo(() => new Set(finalStats.map((s) => s.player_id)), [finalStats]);

  const requiredVotes = useMemo(() => {
    const titularCount = registrations.filter((r) => r.status === 'titular').length;
    return Math.max(2, Math.floor(titularCount / 2));
  }, [registrations]);

  // Group pending proposals by player. More than one proposal for the same
  // player means competing/conflicting stats -> a dispute the group must resolve.
  const pendingGroups = useMemo(() => {
    const byPlayer = new Map();
    proposals
      .filter((p) => !confirmedPlayerIds.has(p.player_id))
      .forEach((p) => {
        const list = byPlayer.get(p.player_id) || [];
        list.push(p);
        byPlayer.set(p.player_id, list);
      });
    return Array.from(byPlayer.values());
  }, [proposals, confirmedPlayerIds]);

  const hasAnyData = proposals.length > 0 || finalStats.length > 0;

  if (loading) return <PageLoader />;

  return (
    <div className="page-container max-w-3xl mx-auto" data-testid="stats-confirmation-page">
      <div className="animate-slide-up">
        <button
          onClick={() => navigate(`/partidos/${id}/post-partido`)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 -ml-1 px-1 py-1"
          data-testid="back-to-post-match"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight mb-2">Confirmación de Estadísticas</h1>
        <p className="text-slate-500 mb-6">
          Las estadísticas se confirman cuando al menos {requiredVotes} jugador{requiredVotes === 1 ? '' : 'es'} votan a favor.
          Si hay dos propuestas distintas para el mismo jugador, quedan marcadas como <strong>disputadas</strong> hasta que una junte los votos necesarios.
        </p>

        {!hasAnyData && (
          <div className="text-center py-16 rounded-3xl border border-dashed border-slate-200 bg-slate-50" data-testid="stats-empty-state">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h2 className="font-heading text-2xl font-bold uppercase tracking-tight text-slate-700">Todavía no hay estadísticas</h2>
            <p className="text-slate-500 mt-1 mb-6">Cargá goles, asistencias o atajadas desde Post Partido para empezar a confirmarlas.</p>
            <Link to={`/partidos/${id}/post-partido`}>
              <Button className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase" data-testid="empty-go-to-post-match">
                Cargar estadísticas
              </Button>
            </Link>
          </div>
        )}

        {/* Confirmed Stats */}
        {finalStats.length > 0 && (
          <Card className="border-turf/20 bg-turf/5 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase flex items-center gap-2 text-turf-accessible">
                <CheckCircle className="w-5 h-5" /> Estadísticas Confirmadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {finalStats.map((s) => (
                  <div key={s.player_id} className="bg-white rounded-xl p-3 border border-turf/10" data-testid={`confirmed-stat-${s.player_id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-slate-900 truncate">{s.player_name}</p>
                      <Badge className="bg-turf text-white shrink-0 gap-1 font-semibold">
                        <CheckCircle className="w-3 h-3" /> Confirmado
                      </Badge>
                    </div>
                    <div className="flex gap-4 mt-1.5 text-xs text-slate-600">
                      {s.goals > 0 && <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {s.goals}</span>}
                      {s.assists > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {s.assists}</span>}
                      {s.saves > 0 && <span className="flex items-center gap-1"><Hand className="w-3 h-3" /> {s.saves}</span>}
                      {!(s.goals > 0) && !(s.assists > 0) && !(s.saves > 0) && <span className="text-slate-400">Sin estadísticas positivas</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending / Disputed Proposals */}
        {proposals.length > 0 && (
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange" /> Propuestas Pendientes
              </CardTitle>
              <p className="text-xs text-slate-500">Votá la propuesta correcta. Necesita {requiredVotes} voto{requiredVotes === 1 ? '' : 's'} para confirmarse.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              {pendingGroups.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4" data-testid="no-pending-proposals">Todas las propuestas ya fueron confirmadas.</p>
              )}

              {pendingGroups.map((group) => {
                const isDisputed = group.length > 1;
                const playerName = group[0].player_name;

                return (
                  <div
                    key={group[0].player_id}
                    className={`rounded-2xl p-4 border ${isDisputed ? 'border-orange/30 bg-orange/5' : 'border-slate-100'}`}
                    data-testid={`proposal-group-${group[0].player_id}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <p className="font-semibold text-sm text-slate-900">{playerName}</p>
                      {isDisputed ? (
                        <Badge className="bg-orange/10 text-orange border-orange/30 font-semibold gap-1" data-testid={`disputed-badge-${group[0].player_id}`}>
                          <AlertTriangle className="w-3 h-3" /> Disputada
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-semibold gap-1" data-testid={`pending-badge-${group[0].player_id}`}>
                          <Clock className="w-3 h-3" /> Pendiente
                        </Badge>
                      )}
                    </div>

                    {isDisputed && (
                      <p className="text-xs text-orange/90 mb-3">
                        Hay {group.length} propuestas distintas para este jugador. Votá la que sea correcta.
                      </p>
                    )}

                    <div className={isDisputed ? 'space-y-3' : ''}>
                      {group.map((p) => {
                        const votesCount = p.votes?.length || 0;
                        const alreadyVoted = Boolean(profileId) && (p.votes || []).includes(profileId);
                        const progress = Math.min(100, Math.round((votesCount / requiredVotes) * 100));

                        return (
                          <div
                            key={p.id}
                            className={`flex items-center justify-between gap-3 py-3 ${isDisputed ? 'rounded-xl border border-slate-100 bg-white px-3' : 'border-b border-slate-50 last:border-0'}`}
                            data-testid={`proposal-${p.id}`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex gap-3 text-xs text-slate-600 flex-wrap">
                                <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {p.goals || 0}</span>
                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {p.assists || 0}</span>
                                <span className="flex items-center gap-1"><Hand className="w-3 h-3" /> {p.saves || 0}</span>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                                  <div className="h-full bg-turf rounded-full transition-all" style={{ width: `${progress}%` }} />
                                </div>
                                <p className="text-xs text-slate-500" data-testid={`vote-count-${p.id}`}>
                                  {votesCount}/{requiredVotes} votos
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={alreadyVoted ? 'ghost' : 'default'}
                              className={`rounded-full shrink-0 min-h-11 min-w-11 ${alreadyVoted ? '' : 'bg-turf hover:bg-turf-dark text-white'}`}
                              onClick={() => handleVote(p.id)}
                              disabled={alreadyVoted || votingId === p.id}
                              data-testid={`vote-proposal-${p.id}`}
                            >
                              {votingId === p.id ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              ) : alreadyVoted ? (
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              ) : (
                                <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                              )}
                              {alreadyVoted ? 'Votado' : 'Confirmar'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
