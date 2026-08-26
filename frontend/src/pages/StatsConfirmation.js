import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ClipboardList,
  Loader2,
  ThumbsUp,
  Vote,
} from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageLoader from '@/components/common/PageLoader';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import SectionHeading from '@/components/teams/SectionHeading';
import StatTriad from '@/components/teams/StatTriad';
import ProgressTrack from '@/components/teams/ProgressTrack';
import MetaChip from '@/components/matches/MetaChip';
import useMatchCatalogs from '@/hooks/use-match-catalogs';

const PANEL = 'rounded-3xl border border-slate-200/70 bg-white p-5 shadow-lift sm:p-6';

export default function StatsConfirmation() {
  const { id } = useParams();
  const { user } = useAuth();
  const [match, setMatch] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [finalStats, setFinalStats] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const { trackableStats } = useMatchCatalogs();
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState('');

  const profileId = user?.profile_id || user?.profile?.id;

  const loadData = async () => {
    try {
      const [matchRes, propRes, finalRes, regsRes] = await Promise.all([
        api.get(`/matches/${id}`).catch(() => ({ data: null })),
        api.get(`/matches/${id}/stats/proposals`),
        api.get(`/matches/${id}/stats/final`),
        api.get(`/matches/${id}/registrations`).catch(() => ({ data: [] })),
      ]);
      setMatch(matchRes.data);
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

  // Las columnas son las que sigue ESTE partido, no las tres de siempre. Un
  // partido que sólo sigue goles no tiene por qué mostrar dos columnas en cero.
  const columnas = useMemo(() => {
    const porId = new Map((trackableStats || []).map((s) => [s.id, s]));
    return (match?.tracked_stats || []).map((statId) => porId.get(statId) || { id: statId, name: statId, short: statId });
  }, [match?.tracked_stats, trackableStats]);

  // En los modos con planilla no hay nada que votar: el organizador carga y
  // queda firme. Sin este aviso, esta pantalla se ve vacía y parece rota.
  const porConsenso = (match?.capabilities?.stats_source || 'consenso') === 'consenso';

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
  const disputadas = pendingGroups.filter((g) => g.length > 1).length;

  if (loading) return <PageLoader />;

  return (
    <div className="page-container mx-auto max-w-3xl" data-testid="stats-confirmation-page">
      <div className="animate-slide-up space-y-6">
        <PageHeader
          slug="estadisticas"
          eyebrow={porConsenso ? 'Se vota entre todos' : 'Las carga el organizador'}
          titulo="Confirmar estadísticas"
          bajada={
            porConsenso
              ? `Una estadística queda confirmada cuando la votan al menos ${requiredVotes} jugador${requiredVotes === 1 ? '' : 'es'}. Si hay dos propuestas distintas para el mismo jugador, quedan disputadas hasta que una junte los votos.`
              : 'En este partido las estadísticas las carga el organizador y quedan firmes al guardar: acá no hay nada que votar.'
          }
          volverA={`/partidos/${id}/post-partido`}
          volverLabel="Volver al post partido"
          volverTestId="back-to-post-match"
          icono={Vote}
          meta={
            hasAnyData ? (
              <>
                <MetaChip icono={CheckCircle} tono={finalStats.length > 0 ? 'turf' : 'apagado'}>
                  {finalStats.length} confirmadas
                </MetaChip>
                <MetaChip icono={Clock} tono={pendingGroups.length > 0 ? 'neutro' : 'apagado'}>
                  {pendingGroups.length} pendientes
                </MetaChip>
                {disputadas > 0 && (
                  <MetaChip icono={AlertTriangle} tono="orange" punto>
                    {disputadas} {disputadas === 1 ? 'disputada' : 'disputadas'}
                  </MetaChip>
                )}
              </>
            ) : null
          }
        />

        {!hasAnyData && (
          <EmptyState
            variante={3}
            icono={ClipboardList}
            titulo="Todavía no hay estadísticas"
            descripcion="Cargá goles, asistencias o atajadas desde Post Partido y acá se van a poder confirmar entre todos."
            testId="stats-empty-state"
            accion={
              <Button
                asChild
                shape="pill"
                className="min-h-11 bg-turf px-7 font-bold uppercase tracking-wider text-white hover:bg-turf-dark focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                data-testid="empty-go-to-post-match"
              >
                <Link to={`/partidos/${id}/post-partido`}>Cargar estadísticas</Link>
              </Button>
            }
          />
        )}

        {/* ---------------- Confirmadas ---------------- */}
        {finalStats.length > 0 && (
          <div className={PANEL}>
            <SectionHeading
              icono={CheckCircle}
              titulo="Ya confirmadas"
              bajada="Estas juntaron los votos necesarios y cuentan para el historial."
            />
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {finalStats.map((s) => (
                <div
                  key={s.player_id}
                  className="rounded-2xl border border-turf/25 bg-turf/5 p-4"
                  data-testid={`confirmed-stat-${s.player_id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{s.player_name}</p>
                    <Badge className="min-h-0 shrink-0 gap-1 border-0 bg-turf font-semibold text-white">
                      <CheckCircle className="h-3 w-3" aria-hidden="true" /> Confirmado
                    </Badge>
                  </div>
                  <StatTriad values={s.values} stats={columnas} className="mt-3" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------- Pendientes y disputadas ---------------- */}
        {proposals.length > 0 && (
          <div className={PANEL}>
            <SectionHeading
              icono={Clock}
              tono="orange"
              titulo="A votar"
              bajada={`Votá la propuesta que sea correcta. Cada una necesita ${requiredVotes} voto${requiredVotes === 1 ? '' : 's'} para confirmarse.`}
            />

            <div className="mt-5 space-y-4">
              {pendingGroups.length === 0 && (
                <p
                  className="rounded-2xl border border-turf/25 bg-turf/5 px-4 py-4 text-center text-sm font-medium text-turf-accessible"
                  data-testid="no-pending-proposals"
                >
                  Todas las propuestas ya fueron confirmadas.
                </p>
              )}

              {pendingGroups.map((group) => {
                const isDisputed = group.length > 1;
                const playerName = group[0].player_name;

                return (
                  <div
                    key={group[0].player_id}
                    className={`rounded-2xl border p-4 ${
                      isDisputed ? 'border-orange/40 bg-orange/5' : 'border-slate-200 bg-white'
                    }`}
                    data-testid={`proposal-group-${group[0].player_id}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{playerName}</p>
                      {isDisputed ? (
                        <Badge
                          className="min-h-0 shrink-0 gap-1 border-orange/40 bg-orange/10 font-semibold text-orange-accessible"
                          data-testid={`disputed-badge-${group[0].player_id}`}
                        >
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Disputada
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="min-h-0 shrink-0 gap-1 bg-slate-100 font-semibold text-slate-700"
                          data-testid={`pending-badge-${group[0].player_id}`}
                        >
                          <Clock className="h-3 w-3" aria-hidden="true" /> Pendiente
                        </Badge>
                      )}
                    </div>

                    {isDisputed && (
                      <p className="mb-3 text-xs font-medium text-orange-accessible">
                        Hay {group.length} propuestas distintas para este jugador. Votá la correcta.
                      </p>
                    )}

                    <div className={isDisputed ? 'space-y-3' : ''}>
                      {group.map((p) => {
                        const votesCount = p.votes?.length || 0;
                        const alreadyVoted = Boolean(profileId) && (p.votes || []).includes(profileId);

                        return (
                          <div
                            key={p.id}
                            className={`flex flex-wrap items-center justify-between gap-3 py-3 ${
                              isDisputed
                                ? 'rounded-xl border border-slate-200 bg-white px-3'
                                : 'border-b border-slate-100 last:border-0 last:pb-0'
                            }`}
                            data-testid={`proposal-${p.id}`}
                          >
                            <div className="min-w-0 flex-1">
                              <StatTriad values={p.values} stats={columnas} />
                              <div className="mt-2.5 flex items-center gap-2">
                                <ProgressTrack
                                  valor={votesCount}
                                  total={requiredVotes}
                                  alto="h-1.5"
                                  className="w-24 bg-slate-100"
                                />
                                <p
                                  className="text-xs font-semibold tabular-nums text-slate-600"
                                  data-testid={`vote-count-${p.id}`}
                                >
                                  {votesCount}/{requiredVotes} votos
                                </p>
                              </div>
                            </div>
                            <Button
                              variant={alreadyVoted ? 'outline' : 'default'}
                              className={`min-h-11 shrink-0 rounded-full px-5 text-xs font-bold uppercase tracking-wide ${
                                alreadyVoted ? '' : 'bg-turf text-white hover:bg-turf-dark'
                              }`}
                              onClick={() => handleVote(p.id)}
                              disabled={alreadyVoted || votingId === p.id}
                              data-testid={`vote-proposal-${p.id}`}
                            >
                              {votingId === p.id ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : alreadyVoted ? (
                                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                              ) : (
                                <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
