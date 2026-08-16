import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  Loader2,
  Send,
  Star,
  UserCircle2,
  Users,
  ZoomIn,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import PageLoader from '@/components/common/PageLoader';
import PhotoLightbox from '@/components/common/PhotoLightbox';
import PageHeader from '@/components/common/PageHeader';
import SectionHeading from '@/components/teams/SectionHeading';
import PeerRatingCard from '@/components/teams/PeerRatingCard';
import ProgressTrack from '@/components/teams/ProgressTrack';
import MetaChip from '@/components/matches/MetaChip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';
import { getRatingTone } from '@/utils/ratings';

const statRowSchema = z.object({
  goals: z.coerce
    .number({ invalid_type_error: 'Ingresá un número válido' })
    .int('Tiene que ser un número entero')
    .min(0, 'No puede ser negativo'),
  assists: z.coerce
    .number({ invalid_type_error: 'Ingresá un número válido' })
    .int('Tiene que ser un número entero')
    .min(0, 'No puede ser negativo'),
  saves: z.coerce
    .number({ invalid_type_error: 'Ingresá un número válido' })
    .int('Tiene que ser un número entero')
    .min(0, 'No puede ser negativo'),
});

const statsFormSchema = z.object({
  stats: z.record(statRowSchema),
});

/** Panel claro. Las tres pestañas usan el mismo, así se leen como hermanas. */
const PANEL = 'rounded-3xl border border-slate-200/70 bg-white p-5 shadow-lift sm:p-6';
const AVISO = 'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900';
const NEUTRO = 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600';
const CAMPO = 'h-11 bg-slate-50 text-center tabular-nums';

export default function PostMatch() {
  const { id } = useParams();
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [ratings, setRatings] = useState({});
  const [selfEval, setSelfEval] = useState({ score: 5, notes: '' });
  const [existingRatings, setExistingRatings] = useState(null);
  const [existingProposals, setExistingProposals] = useState([]);
  const [proposedPlayerIds, setProposedPlayerIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState('');
  const [photoView, setPhotoView] = useState({ open: false, name: '', photoUrl: '', subtitle: '' });

  const profileId = user?.profile_id || user?.profile?.id;
  const activeRegistrations = useMemo(() => registrations.filter((r) => r.status !== 'baja'), [registrations]);
  const myRegistration = activeRegistrations.find((r) => r.player_id === profileId);
  const otherPlayers = activeRegistrations.filter((r) => r.player_id !== profileId);
  const canViewAllScores = Boolean(existingRatings?.can_view_all_scores);
  const playerSummaries = existingRatings?.player_summaries || [];

  const {
    register: registerStat,
    trigger: triggerStat,
    getValues: getStatValues,
    reset: resetStatsForm,
    formState: { errors: statsErrors },
  } = useForm({
    resolver: zodResolver(statsFormSchema),
    defaultValues: { stats: {} },
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [regsRes, ratingsRes, proposalsRes] = await Promise.all([
          api.get(`/matches/${id}/registrations`),
          api.get(`/matches/${id}/ratings`),
          api.get(`/matches/${id}/stats/proposals`).catch(() => ({ data: [] })),
        ]);
        setRegistrations(regsRes.data || []);
        setExistingRatings(ratingsRes.data);
        setExistingProposals(proposalsRes.data || []);
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Error al cargar post partido');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (!profileId || activeRegistrations.length === 0) return;
    const defaults = {};
    activeRegistrations.forEach((player) => {
      defaults[player.player_id] = { goals: 0, assists: 0, saves: 0 };
    });
    const ids = new Set();
    existingProposals.forEach((p) => {
      if (p.proposed_by === profileId) {
        defaults[p.player_id] = {
          goals: p.goals != null ? p.goals : 0,
          assists: p.assists != null ? p.assists : 0,
          saves: p.saves != null ? p.saves : 0,
        };
        ids.add(p.player_id);
      }
    });
    resetStatsForm({ stats: defaults });
    setProposedPlayerIds(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, activeRegistrations, existingProposals]);

  useEffect(() => {
    if (!profileId) return;

    const baseRatings = {};
    otherPlayers.forEach((player) => {
      baseRatings[player.player_id] = 5;
    });

    if (existingRatings?.my_ratings?.length) {
      existingRatings.my_ratings.forEach((rating) => {
        baseRatings[rating.rated_player_id] = rating.score;
      });
    }

    setRatings(baseRatings);
  }, [profileId, registrations, existingRatings]);

  const submitRatings = async () => {
    if (!myRegistration) {
      toast.error('Tenés que estar anotado en este partido para poder evaluar');
      return;
    }

    const ratingsList = otherPlayers.map((player) => ({
      rated_player_id: player.player_id,
      score: parseInt(ratings[player.player_id] ?? 5, 10),
    }));

    if (ratingsList.length === 0) {
      toast.error('No hay otros participantes para evaluar');
      return;
    }

    setSubmitting('ratings');
    try {
      await api.post(`/matches/${id}/ratings`, { ratings: ratingsList });
      toast.success('Evaluaciones guardadas');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar evaluaciones');
    } finally {
      setSubmitting('');
    }
  };

  const submitSelfEval = async () => {
    setSubmitting('self');
    try {
      await api.post(`/matches/${id}/self-evaluation`, selfEval);
      toast.success('Autoevaluación guardada');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar autoevaluación');
    } finally {
      setSubmitting('');
    }
  };

  const submitStats = async (playerId) => {
    const rowIsValid = await triggerStat([
      `stats.${playerId}.goals`,
      `stats.${playerId}.assists`,
      `stats.${playerId}.saves`,
    ]);
    if (!rowIsValid) return;

    const row = getStatValues(`stats.${playerId}`) || {};
    setSubmitting(`stats-${playerId}`);
    try {
      await api.post(`/matches/${id}/stats/propose`, {
        player_id: playerId,
        goals: row.goals ?? 0,
        assists: row.assists ?? 0,
        saves: row.saves ?? 0,
      });
      toast.success('Estadísticas propuestas');
      setProposedPlayerIds((prev) => new Set(prev).add(playerId));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al proponer estadísticas');
    } finally {
      setSubmitting('');
    }
  };

  const openPhoto = (player) => {
    setPhotoView({
      open: true,
      name: player.player_name,
      photoUrl: player.player_photo,
      subtitle: player.primary_position || 'Participante del partido',
    });
  };

  /**
   * Qué puntajes ya están guardados en el servidor, para mostrarlo por tarjeta.
   * Se deriva de lo que ya vino en `my_ratings`: no agrega ningún pedido ni
   * cambia el envío, sólo evita que en una lista de veinte compañeros no se
   * sepa cuáles quedaron grabados y cuáles todavía están tocados a mano.
   */
  const guardados = useMemo(() => {
    const previos = new Map(
      (existingRatings?.my_ratings || []).map((r) => [r.rated_player_id, r.score]),
    );
    const set = new Set();
    previos.forEach((score, playerId) => {
      if ((ratings[playerId] ?? 5) === score) set.add(playerId);
    });
    return set;
  }, [existingRatings, ratings]);

  if (loading) return <PageLoader />;

  const totalAEvaluar = otherPlayers.length;
  const yaGuardados = otherPlayers.filter((p) => guardados.has(p.player_id)).length;
  const propuestasHechas = activeRegistrations.filter((p) => proposedPlayerIds.has(p.player_id)).length;

  return (
    <div className="page-container mx-auto max-w-4xl" data-testid="post-match-page">
      <div className="animate-slide-up space-y-6">
        <PageHeader
          slug="post-partido"
          eyebrow="Terminó el partido"
          titulo="Post partido"
          bajada="Evaluá a tus compañeros, cargá tu autoevaluación y proponé las estadísticas de la fecha."
          volverA={`/partidos/${id}`}
          volverLabel="Volver al partido"
          volverTestId="back-to-match-post"
          icono={ClipboardList}
          meta={
            <>
              <MetaChip icono={Users}>
                {activeRegistrations.length} {activeRegistrations.length === 1 ? 'jugador' : 'jugadores'}
              </MetaChip>
              <MetaChip icono={Star} tono={totalAEvaluar > 0 ? 'turf' : 'apagado'}>
                {totalAEvaluar} a evaluar
              </MetaChip>
              <MetaChip tono={myRegistration ? 'turf' : 'alerta'} punto>
                {myRegistration ? 'Jugaste este partido' : 'No estabas anotado'}
              </MetaChip>
            </>
          }
        />

        <Tabs defaultValue="evaluaciones" className="space-y-5">
          {/* Control segmentado: pastilla blanca sobre riel gris, 44px de alto. */}
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl border border-slate-200/70 bg-slate-100 p-1 shadow-sm">
            {[
              { value: 'evaluaciones', label: 'Evaluaciones', testId: 'tab-evaluaciones' },
              { value: 'autoevaluacion', label: 'Autoevaluación', testId: 'tab-autoevaluacion' },
              { value: 'estadisticas', label: 'Estadísticas', testId: 'tab-estadisticas' },
            ].map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                data-testid={t.testId}
                className="min-h-11 rounded-xl text-xs font-bold uppercase tracking-wide data-[state=active]:bg-white data-[state=active]:text-turf-accessible data-[state=active]:shadow-sm sm:text-sm"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ---------------- Evaluaciones ---------------- */}
          <TabsContent value="evaluaciones" className="mt-0">
            <div className={PANEL}>
              <SectionHeading
                icono={Star}
                titulo="Evaluá a tus compañeros"
                bajada="Puntuación del 1 al 10. Podés volver a cambiarla más adelante."
                acciones={
                  totalAEvaluar > 0 ? (
                    <span className="text-xs font-semibold tabular-nums text-slate-600">
                      {yaGuardados}/{totalAEvaluar} guardadas
                    </span>
                  ) : null
                }
              />

              {totalAEvaluar > 0 && (
                <ProgressTrack valor={yaGuardados} total={totalAEvaluar} className="mt-4" />
              )}

              <div className="mt-5 space-y-4">
                {!myRegistration && (
                  <p className={AVISO}>
                    Tenés que estar anotado en este partido para poder evaluar y proponer estadísticas.
                  </p>
                )}

                {myRegistration && otherPlayers.length === 0 && (
                  <p className={NEUTRO}>No hay otros participantes para evaluar todavía.</p>
                )}

                {canViewAllScores && playerSummaries.length > 0 && (
                  <div
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    data-testid="organizer-score-summary"
                  >
                    <div className="flex items-start gap-3">
                      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-200 text-slate-700">
                        <Eye className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Resumen interno de puntajes</p>
                        <p className="text-xs text-slate-600">Visible sólo para organizadores y admins.</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {playerSummaries.map((summary) => {
                        const tono = getRatingTone(summary.avg_peer_score);
                        return (
                          <div
                            key={summary.player_id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">{summary.player_name}</p>
                              <p className="text-xs text-slate-600">
                                {summary.peer_rating_count} voto{summary.peer_rating_count === 1 ? '' : 's'}
                                {summary.peer_scores?.length
                                  ? ` · ${summary.peer_scores.join(', ')}`
                                  : ' · Sin votos aún'}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={`font-heading text-lg font-bold tabular-nums ${tono.text}`}>
                                {summary.avg_peer_score != null ? summary.avg_peer_score : '-'}
                              </p>
                              <p className="text-[11px] text-slate-600">
                                Auto: {summary.self_evaluation?.score ?? '-'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {otherPlayers.map((player) => {
                  const score = ratings[player.player_id] ?? 5;
                  const setScore = (next) =>
                    setRatings((prev) => ({
                      ...prev,
                      [player.player_id]: Math.min(10, Math.max(1, next)),
                    }));
                  return (
                    <PeerRatingCard
                      key={player.player_id}
                      player={player}
                      score={score}
                      tone={getRatingTone(score)}
                      guardado={guardados.has(player.player_id)}
                      disabled={!myRegistration}
                      onScoreChange={setScore}
                      onOpenPhoto={openPhoto}
                    />
                  );
                })}
              </div>

              {/* Barra de envío pegada abajo: con veinte compañeros el botón queda
                  a varios scrolls de la última tarjeta. */}
              <div className="sticky bottom-3 z-10 mt-5">
                <div className="glass rounded-2xl p-2 shadow-lift">
                  <Button
                    data-testid="submit-ratings-btn"
                    onClick={submitRatings}
                    disabled={submitting === 'ratings' || !myRegistration || otherPlayers.length === 0}
                    shape="pill"
                    className="min-h-12 w-full bg-turf font-bold uppercase tracking-wider text-white hover:bg-turf-dark focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                  >
                    {submitting === 'ratings' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Star className="mr-2 h-4 w-4" />
                    )}
                    {existingRatings?.has_rated ? 'Actualizar evaluaciones' : 'Guardar evaluaciones'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ---------------- Autoevaluación ---------------- */}
          <TabsContent value="autoevaluacion" className="mt-0">
            <div className={PANEL}>
              <SectionHeading
                icono={UserCircle2}
                tono="slate"
                titulo="Tu autoevaluación"
                bajada="Sólo la ves vos. No afecta tu rating general."
              />

              <div className="mt-5 space-y-4">
                {(() => {
                  const tono = getRatingTone(selfEval.score);
                  return (
                    <div className={`rounded-2xl border p-5 ${tono.border} ${tono.bg}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <Label className="text-sm font-semibold text-slate-900">
                            ¿Cómo te fue?
                          </Label>
                          <p className={`mt-0.5 text-xs font-bold uppercase tracking-wide ${tono.text}`}>
                            {tono.label}
                          </p>
                        </div>
                        <span
                          className={`grid h-16 w-16 place-items-center rounded-2xl bg-white/80 font-heading text-4xl font-bold tabular-nums ${tono.text}`}
                          data-testid="self-eval-score-value"
                        >
                          {selfEval.score}
                        </span>
                      </div>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[selfEval.score]}
                        onValueChange={(value) => setSelfEval((prev) => ({ ...prev, score: value[0] }))}
                        className="mt-5"
                        data-testid="self-eval-slider"
                        aria-label="Tu puntuación de autoevaluación"
                      />
                      <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-slate-500" aria-hidden="true">
                        <span>1</span>
                        <span>10</span>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <Label htmlFor="self-eval-notes" className="text-sm font-semibold text-slate-900">
                    Notas (opcional)
                  </Label>
                  <textarea
                    id="self-eval-notes"
                    data-testid="self-eval-notes"
                    value={selfEval.notes}
                    onChange={(event) => setSelfEval((prev) => ({ ...prev, notes: event.target.value }))}
                    className="mt-1.5 h-28 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm placeholder:text-slate-500 focus:border-turf focus:ring-2 focus:ring-turf/20"
                    placeholder="¿Cómo sentís que jugaste hoy?"
                  />
                </div>

                <Button
                  data-testid="submit-self-eval"
                  onClick={submitSelfEval}
                  disabled={submitting === 'self'}
                  shape="pill"
                  className="min-h-12 w-full bg-secondary font-bold uppercase tracking-wider text-secondary-foreground"
                >
                  {submitting === 'self' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Guardar autoevaluación
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ---------------- Estadísticas ---------------- */}
          <TabsContent value="estadisticas" className="mt-0">
            <div className={PANEL}>
              <SectionHeading
                icono={ClipboardList}
                tono="orange"
                titulo="Proponer estadísticas"
                bajada="Después se validan con los votos del resto de los jugadores."
                acciones={
                  activeRegistrations.length > 0 ? (
                    <span className="text-xs font-semibold tabular-nums text-slate-600">
                      {propuestasHechas}/{activeRegistrations.length} propuestas
                    </span>
                  ) : null
                }
              />

              <div className="mt-5 space-y-4">
                {!myRegistration && (
                  <p className={AVISO}>
                    Tenés que estar anotado en este partido para poder proponer estadísticas.
                  </p>
                )}

                {activeRegistrations.length === 0 && (
                  <p className={NEUTRO}>No hay participantes cargados para este partido todavía.</p>
                )}

                {activeRegistrations.map((player) => {
                  const alreadyProposed = proposedPlayerIds.has(player.player_id);
                  const errores = statsErrors.stats?.[player.player_id];
                  return (
                    <div
                      key={player.player_id}
                      className={`rounded-2xl border p-4 transition-colors ${
                        alreadyProposed ? 'border-turf/25 bg-turf/5' : 'border-slate-200 bg-white'
                      }`}
                      data-testid={`stats-player-${player.player_id}`}
                    >
                      <div className="mb-4 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openPhoto(player)}
                          className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                          aria-label={`Ver foto de ${player.player_name}`}
                        >
                          <Avatar className="h-11 w-11 shadow-sm ring-2 ring-white">
                            <AvatarImage src={buildPhotoUrl(player.player_photo) || undefined} />
                            <AvatarFallback className="bg-turf/10 text-xs font-bold text-turf-accessible">
                              {initialsFromName(player.player_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors group-hover:text-turf-accessible">
                            <ZoomIn className="h-3 w-3" aria-hidden="true" />
                          </span>
                        </button>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {player.player_name}
                          </span>
                          <span className="text-xs text-slate-600">
                            {player.primary_position || 'Sin posición cargada'}
                          </span>
                        </div>
                        {alreadyProposed && (
                          <Badge
                            className="min-h-0 gap-1 border-turf/25 bg-turf/10 font-semibold text-turf-accessible"
                            data-testid={`proposed-badge-${player.player_id}`}
                          >
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Propuesto
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {/* Los data-testid van escritos enteros a proposito y no armados
                            como `stat-${campo}-...`: hay tests que dependen de estos
                            nombres, y si el prefijo se arma con una variable dejan de
                            aparecer al buscarlos en el codigo. */}
                        {[
                          { campo: 'goals', label: 'Goles', testId: 'stat-goals', errorTestId: 'stat-goals-error' },
                          { campo: 'assists', label: 'Asistencias', testId: 'stat-assists', errorTestId: 'stat-assists-error' },
                          { campo: 'saves', label: 'Atajadas', testId: 'stat-saves', errorTestId: 'stat-saves-error' },
                        ].map(({ campo, label, testId, errorTestId }) => (
                          <div key={campo}>
                            <Label
                              className="text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                              htmlFor={`${campo}-${player.player_id}`}
                            >
                              {label}
                            </Label>
                            <Input
                              id={`${campo}-${player.player_id}`}
                              data-testid={`${testId}-${player.player_id}`}
                              type="number"
                              min="0"
                              inputMode="numeric"
                              className={CAMPO}
                              disabled={!myRegistration}
                              aria-invalid={errores?.[campo] ? 'true' : undefined}
                              {...registerStat(`stats.${player.player_id}.${campo}`)}
                            />
                            {errores?.[campo] && (
                              <p
                                className="mt-1 text-[11px] text-destructive"
                                data-testid={`${errorTestId}-${player.player_id}`}
                              >
                                {errores[campo].message}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      <Button
                        variant={alreadyProposed ? 'outline' : 'default'}
                        className={`mt-4 min-h-11 w-full rounded-xl text-xs font-bold uppercase tracking-wide ${
                          alreadyProposed ? '' : 'bg-turf text-white hover:bg-turf-dark'
                        }`}
                        onClick={() => submitStats(player.player_id)}
                        disabled={submitting === `stats-${player.player_id}` || !myRegistration}
                        data-testid={`submit-stats-${player.player_id}`}
                      >
                        {submitting === `stats-${player.player_id}` ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : alreadyProposed ? (
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        ) : (
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {alreadyProposed ? 'Actualizar propuesta' : 'Proponer'}
                      </Button>
                    </div>
                  );
                })}

                <Button
                  asChild
                  variant="outline"
                  className="min-h-11 w-full rounded-xl font-semibold"
                  data-testid="go-to-stats-confirmation"
                >
                  <Link to={`/partidos/${id}/estadisticas`}>
                    Ver estado de confirmación
                    <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <PhotoLightbox
        open={photoView.open}
        onOpenChange={(open) => setPhotoView((prev) => ({ ...prev, open }))}
        name={photoView.name}
        photoUrl={photoView.photoUrl}
        subtitle={photoView.subtitle}
      />
    </div>
  );
}
