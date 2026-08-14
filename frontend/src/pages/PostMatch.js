import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, ClipboardList, Loader2, Minus, Plus, Send, Star, UserCircle2, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import PageLoader from '@/components/common/PageLoader';
import PhotoLightbox from '@/components/common/PhotoLightbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export default function PostMatch() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
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

  if (loading) return <PageLoader />;

  return (
    <div className="page-container max-w-4xl mx-auto" data-testid="post-match-page">
      <div className="animate-slide-up space-y-6">
        <button
          onClick={() => navigate(`/partidos/${id}`)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 -ml-1 px-1 py-1"
          data-testid="back-to-match-post"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al partido
        </button>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-7 shadow-sm">
          <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">Post Partido</h1>
          <p className="text-slate-500 mt-2">
            Evaluá a tus compañeros, cargá tu autoevaluación y proponé estadísticas. Las fotos también se pueden ampliar.
          </p>

          <div className="grid grid-cols-3 gap-3 mt-6">
            <Card className="border-slate-100 shadow-none"><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Jugadores</p><p className="text-2xl font-bold mt-1">{activeRegistrations.length}</p></CardContent></Card>
            <Card className="border-slate-100 shadow-none"><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">A evaluar</p><p className="text-2xl font-bold mt-1">{otherPlayers.length}</p></CardContent></Card>
            <Card className="border-slate-100 shadow-none"><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Tu estado</p><p className="text-lg font-bold mt-1">{myRegistration ? 'Participante' : 'Sin inscripción'}</p></CardContent></Card>
          </div>
        </section>

        <Tabs defaultValue="evaluaciones" className="space-y-6">
          <TabsList className="w-full grid grid-cols-3 h-12 bg-slate-100 rounded-xl">
            <TabsTrigger value="evaluaciones" className="rounded-lg font-semibold text-sm" data-testid="tab-evaluaciones">Evaluaciones</TabsTrigger>
            <TabsTrigger value="autoevaluacion" className="rounded-lg font-semibold text-sm" data-testid="tab-autoevaluacion">Autoevaluación</TabsTrigger>
            <TabsTrigger value="estadisticas" className="rounded-lg font-semibold text-sm" data-testid="tab-estadisticas">Estadísticas</TabsTrigger>
          </TabsList>

          <TabsContent value="evaluaciones">
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-lg uppercase flex items-center gap-2"><Star className="w-4 h-4" /> Evaluá a tus compañeros</CardTitle>
                <p className="text-xs text-slate-500">Puntuación del 1 al 10. Tus cambios se pueden actualizar después.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!myRegistration && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Tenés que estar anotado en este partido para poder evaluar y proponer estadísticas.
                  </div>
                )}

                {myRegistration && otherPlayers.length === 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    No hay otros participantes para evaluar todavía.
                  </div>
                )}

                {canViewAllScores && playerSummaries.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3" data-testid="organizer-score-summary">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Resumen interno de puntajes</p>
                      <p className="text-xs text-slate-500">Visible solo para organizadores y admins.</p>
                    </div>
                    <div className="space-y-2">
                      {playerSummaries.map((summary) => (
                        <div key={summary.player_id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 border border-slate-100">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{summary.player_name}</p>
                            <p className="text-xs text-slate-500">
                              {summary.peer_rating_count} voto{summary.peer_rating_count === 1 ? '' : 's'}
                              {summary.peer_scores?.length ? ` · ${summary.peer_scores.join(', ')}` : ' · Sin votos aún'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-turf-accessible">{summary.avg_peer_score != null ? summary.avg_peer_score : '-'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Auto: {summary.self_evaluation?.score ?? '-'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {otherPlayers.map((player) => {
                  const score = ratings[player.player_id] ?? 5;
                  const tone = getRatingTone(score);
                  const setScore = (next) => setRatings((prev) => ({ ...prev, [player.player_id]: Math.min(10, Math.max(1, next)) }));
                  return (
                    <div key={player.player_id} className={`rounded-2xl border p-4 transition-colors ${tone.ring} ring-1 border-slate-100`} data-testid={`rate-player-${player.player_id}`}>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openPhoto(player)}
                          className="relative group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                          data-testid={`view-photo-${player.player_id}`}
                          aria-label={`Ver foto de ${player.player_name}`}
                        >
                          <Avatar className="w-11 h-11 ring-2 ring-white shadow-sm">
                            <AvatarImage src={buildPhotoUrl(player.player_photo) || undefined} />
                            <AvatarFallback className="bg-turf/10 text-turf-accessible text-xs font-bold">{initialsFromName(player.player_name)}</AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-turf-accessible transition-colors"><ZoomIn className="w-3 h-3" /></span>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{player.player_name}</p>
                          <p className="text-xs text-slate-500">{player.primary_position || 'Sin posición cargada'}</p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 rounded-full shrink-0 active:scale-95 transition-transform"
                            onClick={() => setScore(score - 1)}
                            disabled={!myRegistration || score <= 1}
                            data-testid={`rating-decrement-${player.player_id}`}
                            aria-label={`Bajar puntaje de ${player.player_name}`}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className={`text-lg font-bold w-10 h-10 rounded-full flex items-center justify-center ${tone.text} ${tone.bg}`} data-testid={`rating-value-${player.player_id}`}>
                            {score}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 rounded-full shrink-0 active:scale-95 transition-transform"
                            onClick={() => setScore(score + 1)}
                            disabled={!myRegistration || score >= 10}
                            data-testid={`rating-increment-${player.player_id}`}
                            aria-label={`Subir puntaje de ${player.player_name}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[score]}
                        onValueChange={(value) => setScore(value[0])}
                        className="mt-4"
                        disabled={!myRegistration}
                        data-testid={`rating-slider-${player.player_id}`}
                        aria-label={`Puntuación para ${player.player_name}`}
                      />
                    </div>
                  );
                })}

                <Button
                  data-testid="submit-ratings-btn"
                  onClick={submitRatings}
                  disabled={submitting === 'ratings' || !myRegistration || otherPlayers.length === 0}
                  shape="pill"
                  className="w-full bg-turf hover:bg-turf-dark text-white min-h-12"
                >
                  {submitting === 'ratings' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
                  {existingRatings?.has_rated ? 'Actualizar evaluaciones' : 'Guardar evaluaciones'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="autoevaluacion">
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-lg uppercase flex items-center gap-2"><UserCircle2 className="w-4 h-4" /> Tu autoevaluación</CardTitle>
                <p className="text-xs text-slate-500">Solo vos podés ver esto. No afecta tu rating general.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`rounded-2xl border p-4 ${getRatingTone(selfEval.score).ring} ring-1 border-slate-100`}>
                  <div className="flex items-center justify-between">
                    <Label>Puntuación</Label>
                    <span className={`text-lg font-bold w-10 h-10 rounded-full flex items-center justify-center ${getRatingTone(selfEval.score).text} ${getRatingTone(selfEval.score).bg}`} data-testid="self-eval-score-value">
                      {selfEval.score}
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={[selfEval.score]}
                    onValueChange={(value) => setSelfEval((prev) => ({ ...prev, score: value[0] }))}
                    className="mt-3"
                    data-testid="self-eval-slider"
                    aria-label="Tu puntuación de autoevaluación"
                  />
                </div>
                <div>
                  <Label htmlFor="self-eval-notes">Notas (opcional)</Label>
                  <textarea
                    id="self-eval-notes"
                    data-testid="self-eval-notes"
                    value={selfEval.notes}
                    onChange={(event) => setSelfEval((prev) => ({ ...prev, notes: event.target.value }))}
                    className="mt-1.5 w-full h-28 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:border-turf focus:ring-2 focus:ring-turf/20"
                    placeholder="¿Cómo sentís que jugaste hoy?"
                  />
                </div>
                <Button data-testid="submit-self-eval" onClick={submitSelfEval} disabled={submitting === 'self'} shape="pill" className="w-full bg-secondary text-secondary-foreground min-h-12">
                  {submitting === 'self' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Guardar autoevaluación
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="estadisticas">
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-lg uppercase flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Proponer estadísticas</CardTitle>
                <p className="text-xs text-slate-500">Las estadísticas después se validan con votos del resto de los jugadores.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!myRegistration && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Tenés que estar anotado en este partido para poder proponer estadísticas.
                  </div>
                )}

                {activeRegistrations.length === 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    No hay participantes cargados para este partido todavía.
                  </div>
                )}

                {activeRegistrations.map((player) => {
                  const alreadyProposed = proposedPlayerIds.has(player.player_id);
                  return (
                    <div key={player.player_id} className="border border-slate-100 rounded-2xl p-4" data-testid={`stats-player-${player.player_id}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <button
                          type="button"
                          onClick={() => openPhoto(player)}
                          className="relative group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                          aria-label={`Ver foto de ${player.player_name}`}
                        >
                          <Avatar className="w-10 h-10 ring-2 ring-white shadow-sm">
                            <AvatarImage src={buildPhotoUrl(player.player_photo) || undefined} />
                            <AvatarFallback className="bg-turf/10 text-turf-accessible text-xs font-bold">{initialsFromName(player.player_name)}</AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-turf-accessible transition-colors"><ZoomIn className="w-3 h-3" /></span>
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium block truncate">{player.player_name}</span>
                          <span className="text-xs text-slate-500">{player.primary_position || 'Sin posición cargada'}</span>
                        </div>
                        {alreadyProposed && (
                          <Badge className="bg-turf/10 text-turf-accessible border-turf/20 font-semibold gap-1" data-testid={`proposed-badge-${player.player_id}`}>
                            <CheckCircle2 className="w-3 h-3" /> Propuesto
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs" htmlFor={`goals-${player.player_id}`}>Goles</Label>
                          <Input
                            id={`goals-${player.player_id}`}
                            data-testid={`stat-goals-${player.player_id}`}
                            type="number"
                            min="0"
                            inputMode="numeric"
                            className="h-11 bg-slate-50 text-center"
                            disabled={!myRegistration}
                            {...registerStat(`stats.${player.player_id}.goals`)}
                          />
                          {statsErrors.stats?.[player.player_id]?.goals && (
                            <p className="mt-1 text-[11px] text-destructive" data-testid={`stat-goals-error-${player.player_id}`}>
                              {statsErrors.stats[player.player_id].goals.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs" htmlFor={`assists-${player.player_id}`}>Asistencias</Label>
                          <Input
                            id={`assists-${player.player_id}`}
                            data-testid={`stat-assists-${player.player_id}`}
                            type="number"
                            min="0"
                            inputMode="numeric"
                            className="h-11 bg-slate-50 text-center"
                            disabled={!myRegistration}
                            {...registerStat(`stats.${player.player_id}.assists`)}
                          />
                          {statsErrors.stats?.[player.player_id]?.assists && (
                            <p className="mt-1 text-[11px] text-destructive" data-testid={`stat-assists-error-${player.player_id}`}>
                              {statsErrors.stats[player.player_id].assists.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs" htmlFor={`saves-${player.player_id}`}>Atajadas</Label>
                          <Input
                            id={`saves-${player.player_id}`}
                            data-testid={`stat-saves-${player.player_id}`}
                            type="number"
                            min="0"
                            inputMode="numeric"
                            className="h-11 bg-slate-50 text-center"
                            disabled={!myRegistration}
                            {...registerStat(`stats.${player.player_id}.saves`)}
                          />
                          {statsErrors.stats?.[player.player_id]?.saves && (
                            <p className="mt-1 text-[11px] text-destructive" data-testid={`stat-saves-error-${player.player_id}`}>
                              {statsErrors.stats[player.player_id].saves.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={alreadyProposed ? 'ghost' : 'outline'}
                        className="mt-3 w-full rounded-xl text-xs min-h-11"
                        onClick={() => submitStats(player.player_id)}
                        disabled={submitting === `stats-${player.player_id}` || !myRegistration}
                        data-testid={`submit-stats-${player.player_id}`}
                      >
                        {submitting === `stats-${player.player_id}` ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : alreadyProposed ? (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        ) : (
                          <Send className="w-3 h-3 mr-1" />
                        )}
                        {alreadyProposed ? 'Actualizar propuesta' : 'Proponer'}
                      </Button>
                    </div>
                  );
                })}

                <Link to={`/partidos/${id}/estadisticas`}>
                  <Button variant="outline" className="w-full rounded-xl min-h-11" data-testid="go-to-stats-confirmation">
                    Ver estado de confirmación
                  </Button>
                </Link>
              </CardContent>
            </Card>
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
