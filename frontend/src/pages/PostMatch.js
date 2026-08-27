import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ClipboardList,
  Eye,
  Loader2,
  Star,
  UserCircle2,
  Users,
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
import StatsSheet from '@/components/matches/StatsSheet';
import EmptyState from '@/components/common/EmptyState';
import useMatchCatalogs from '@/hooks/use-match-catalogs';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getRatingTone } from '@/utils/ratings';

/** Panel claro. Las tres pestañas usan el mismo, así se leen como hermanas. */
const PANEL = 'rounded-3xl border border-slate-200/70 bg-white p-5 shadow-lift sm:p-6';
const AVISO = 'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900';
const NEUTRO = 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600';

export default function PostMatch() {
  const { id } = useParams();
  const { user } = useAuth();
  const [match, setMatch] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [ratings, setRatings] = useState({});
  const [selfEval, setSelfEval] = useState({ score: 5, notes: '' });
  const [existingRatings, setExistingRatings] = useState(null);
  const [existingProposals, setExistingProposals] = useState([]);
  const [existingFinal, setExistingFinal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState('');
  const [photoView, setPhotoView] = useState({ open: false, name: '', photoUrl: '', subtitle: '' });
  // Contador para volver a pedir todo después de guardar la planilla. Es más
  // barato que replicar acá el estado que ya sabe el servidor.
  const [recarga, setRecarga] = useState(0);

  const profileId = user?.profile_id || user?.profile?.id;
  const activeRegistrations = useMemo(() => registrations.filter((r) => r.status !== 'baja'), [registrations]);
  const myRegistration = activeRegistrations.find((r) => r.player_id === profileId);
  const otherPlayers = activeRegistrations.filter((r) => r.player_id !== profileId);
  const canViewAllScores = Boolean(existingRatings?.can_view_all_scores);
  const playerSummaries = existingRatings?.player_summaries || [];
  const { trackableStats } = useMatchCatalogs();

  // Qué se pide en esta pantalla lo decide el modo del partido, no la pantalla.
  // Un partido de Diversión no muestra ninguna pestaña, y no porque acá haya un
  // `if` con su nombre: porque sus capacidades dicen que no evalúa ni sigue
  // estadísticas.
  const capacidades = match?.capabilities || {};
  const evaluaPorPartido = Boolean(capacidades.rating_por_partido);
  const llevaEstadisticas = Boolean(match?.tracked_stats?.length);
  const isOrganizer = Boolean(
    match?.can_manage || match?.organizer_id === profileId || user?.role === 'admin',
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [matchRes, regsRes, ratingsRes, proposalsRes, finalRes] = await Promise.all([
          api.get(`/matches/${id}`),
          api.get(`/matches/${id}/registrations`),
          api.get(`/matches/${id}/ratings`),
          api.get(`/matches/${id}/stats/proposals`).catch(() => ({ data: [] })),
          api.get(`/matches/${id}/stats/final`).catch(() => ({ data: [] })),
        ]);
        setMatch(matchRes.data);
        setRegistrations(regsRes.data || []);
        setExistingRatings(ratingsRes.data);
        setExistingProposals(proposalsRes.data || []);
        setExistingFinal(finalRes.data || []);
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Error al cargar post partido');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, recarga]);

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
    // otherPlayers se deriva de registrations y profileId, que sí están en la
    // lista. Agregarlo sería un bucle: es un array nuevo en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Las pestañas que existen dependen del modo. No se muestran deshabilitadas:
  // una pestaña gris que no se puede tocar es una pregunta sin respuesta.
  const pestanas = [
    ...(evaluaPorPartido
      ? [
          { value: 'evaluaciones', label: 'Evaluaciones', testId: 'tab-evaluaciones' },
          { value: 'autoevaluacion', label: 'Autoevaluación', testId: 'tab-autoevaluacion' },
        ]
      : []),
    ...(llevaEstadisticas
      ? [{ value: 'estadisticas', label: 'Estadísticas', testId: 'tab-estadisticas' }]
      : []),
  ];

  // Tailwind necesita las clases escritas enteras para poder verlas al compilar:
  // `grid-cols-${n}` se queda afuera del CSS final.
  const COLUMNAS_TAB = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' };

  const bajadaSegunModo = evaluaPorPartido
    ? (llevaEstadisticas
      ? 'Evaluá a tus compañeros, cargá tu autoevaluación y las estadísticas de la fecha.'
      : 'Evaluá a tus compañeros y cargá tu autoevaluación.')
    : 'Cargá las estadísticas de la fecha.';

  return (
    <div className="page-container mx-auto max-w-4xl" data-testid="post-match-page">
      <div className="animate-slide-up space-y-6">
        <PageHeader
          slug="post-partido"
          eyebrow="Terminó el partido"
          titulo="Post partido"
          bajada={bajadaSegunModo}
          volverA={`/partidos/${id}`}
          volverLabel="Volver al partido"
          volverTestId="back-to-match-post"
          icono={ClipboardList}
          meta={
            <>
              <MetaChip icono={Users}>
                {activeRegistrations.length} {activeRegistrations.length === 1 ? 'jugador' : 'jugadores'}
              </MetaChip>
              {evaluaPorPartido && (
                <MetaChip icono={Star} tono={totalAEvaluar > 0 ? 'turf' : 'apagado'}>
                  {totalAEvaluar} a evaluar
                </MetaChip>
              )}
              <MetaChip tono={myRegistration ? 'turf' : 'alerta'} punto>
                {myRegistration ? 'Jugaste este partido' : 'No estabas anotado'}
              </MetaChip>
            </>
          }
        />

        {pestanas.length === 0 && (
          <div className={PANEL}>
            <EmptyState
              variante={2}
              icono={ClipboardList}
              titulo="Acá no hay nada que cargar"
              descripcion="Este partido no lleva evaluaciones ni estadísticas. El resultado se carga desde la pantalla del partido."
              testId="post-match-sin-tareas"
            />
            <Button
              asChild
              variant="outline"
              className="mt-4 min-h-11 w-full rounded-xl font-semibold"
              data-testid="back-to-match-empty"
            >
              <Link to={`/partidos/${id}`}>Volver al partido</Link>
            </Button>
          </div>
        )}

        {pestanas.length > 0 && (
        <Tabs defaultValue={pestanas[0].value} className="space-y-5">
          {/* Control segmentado: pastilla blanca sobre riel gris, 44px de alto. */}
          <TabsList
            className={`grid h-auto w-full ${COLUMNAS_TAB[pestanas.length] || 'grid-cols-3'} gap-1 rounded-2xl border border-slate-200/70 bg-slate-100 p-1 shadow-sm`}
          >
            {pestanas.map((t) => (
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
                    className="min-h-12 w-full bg-turf-btn font-bold uppercase tracking-wider text-white hover:bg-turf-btn-dark focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
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
                      <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-slate-600" aria-hidden="true">
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
                    className="mt-1.5 h-28 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm placeholder:text-slate-600 focus:border-turf focus:ring-2 focus:ring-turf/20"
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
              <StatsSheet
                matchId={id}
                match={match}
                players={activeRegistrations}
                trackableStats={trackableStats}
                existingProposals={existingProposals}
                existingFinal={existingFinal}
                myRegistration={myRegistration}
                isOrganizer={isOrganizer}
                profileId={profileId}
                onAbrirFoto={openPhoto}
                onSaved={() => setRecarga((n) => n + 1)}
              />
            </div>
          </TabsContent>
        </Tabs>
        )}
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
