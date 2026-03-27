import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Send, Star, UserCircle2, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import PageLoader from '@/components/common/PageLoader';
import PhotoLightbox from '@/components/common/PhotoLightbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';

export default function PostMatch() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState([]);
  const [ratings, setRatings] = useState({});
  const [selfEval, setSelfEval] = useState({ score: 5, notes: '' });
  const [stats, setStats] = useState({});
  const [existingRatings, setExistingRatings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState('');
  const [photoView, setPhotoView] = useState({ open: false, name: '', photoUrl: '', subtitle: '' });

  const profileId = user?.profile_id || user?.profile?.id;
  const activeRegistrations = useMemo(() => registrations.filter((r) => r.status !== 'baja'), [registrations]);
  const myRegistration = activeRegistrations.find((r) => r.player_id === profileId);
  const otherPlayers = activeRegistrations.filter((r) => r.player_id !== profileId);

  useEffect(() => {
    const load = async () => {
      try {
        const [regsRes, ratingsRes] = await Promise.all([
          api.get(`/matches/${id}/registrations`),
          api.get(`/matches/${id}/ratings`),
        ]);
        setRegistrations(regsRes.data || []);
        setExistingRatings(ratingsRes.data);
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Error al cargar post partido');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

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
    const s = stats[playerId];
    if (!s) return;
    setSubmitting(`stats-${playerId}`);
    try {
      await api.post(`/matches/${id}/stats/propose`, {
        player_id: playerId,
        goals: parseInt(s.goals) || 0,
        assists: parseInt(s.assists) || 0,
        saves: parseInt(s.saves) || 0,
      });
      toast.success('Estadísticas propuestas');
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
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
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
            <Card className="border-slate-100 shadow-none"><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Jugadores</p><p className="text-2xl font-bold mt-1">{activeRegistrations.length}</p></CardContent></Card>
            <Card className="border-slate-100 shadow-none"><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-slate-400">A evaluar</p><p className="text-2xl font-bold mt-1">{otherPlayers.length}</p></CardContent></Card>
            <Card className="border-slate-100 shadow-none"><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Tu estado</p><p className="text-lg font-bold mt-1">{myRegistration ? 'Participante' : 'Sin inscripción'}</p></CardContent></Card>
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

                {otherPlayers.map((player) => (
                  <div key={player.player_id} className="rounded-2xl border border-slate-100 p-4" data-testid={`rate-player-${player.player_id}`}>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => openPhoto(player)} className="relative group rounded-full">
                        <Avatar className="w-11 h-11 ring-2 ring-white shadow-sm">
                          <AvatarImage src={buildPhotoUrl(player.player_photo) || undefined} />
                          <AvatarFallback className="bg-turf/10 text-turf text-xs font-bold">{initialsFromName(player.player_name)}</AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-turf transition-colors"><ZoomIn className="w-3 h-3" /></span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{player.player_name}</p>
                        <p className="text-xs text-slate-400">{player.primary_position || 'Sin posición cargada'}</p>
                      </div>
                      <span className="text-lg font-bold text-turf w-8 text-center">{ratings[player.player_id] ?? 5}</span>
                    </div>

                    <Slider
                      min={1}
                      max={10}
                      step={1}
                      value={[ratings[player.player_id] ?? 5]}
                      onValueChange={(value) => setRatings((prev) => ({ ...prev, [player.player_id]: value[0] }))}
                      className="mt-4"
                      disabled={!myRegistration}
                    />
                  </div>
                ))}

                <Button
                  data-testid="submit-ratings-btn"
                  onClick={submitRatings}
                  disabled={submitting === 'ratings' || !myRegistration || otherPlayers.length === 0}
                  className="w-full bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase"
                >
                  <Star className="w-4 h-4 mr-2" /> {existingRatings?.has_rated ? 'Actualizar evaluaciones' : 'Guardar evaluaciones'}
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
                <div className="rounded-2xl border border-slate-100 p-4">
                  <Label>Puntuación: {selfEval.score}</Label>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={[selfEval.score]}
                    onValueChange={(value) => setSelfEval((prev) => ({ ...prev, score: value[0] }))}
                    className="mt-3"
                  />
                </div>
                <div>
                  <Label>Notas (opcional)</Label>
                  <textarea
                    data-testid="self-eval-notes"
                    value={selfEval.notes}
                    onChange={(event) => setSelfEval((prev) => ({ ...prev, notes: event.target.value }))}
                    className="mt-1.5 w-full h-28 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:border-turf focus:ring-2 focus:ring-turf/20"
                    placeholder="¿Cómo sentís que jugaste hoy?"
                  />
                </div>
                <Button data-testid="submit-self-eval" onClick={submitSelfEval} disabled={submitting === 'self'} className="w-full bg-slate-800 text-white rounded-xl font-bold uppercase">
                  Guardar autoevaluación
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
                {activeRegistrations.map((player) => (
                  <div key={player.player_id} className="border border-slate-100 rounded-2xl p-4" data-testid={`stats-player-${player.player_id}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <button type="button" onClick={() => openPhoto(player)} className="relative group rounded-full">
                        <Avatar className="w-10 h-10 ring-2 ring-white shadow-sm">
                          <AvatarImage src={buildPhotoUrl(player.player_photo) || undefined} />
                          <AvatarFallback className="bg-turf/10 text-turf text-xs font-bold">{initialsFromName(player.player_name)}</AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-turf transition-colors"><ZoomIn className="w-3 h-3" /></span>
                      </button>
                      <div>
                        <span className="text-sm font-medium block">{player.player_name}</span>
                        <span className="text-xs text-slate-400">{player.primary_position || 'Sin posición cargada'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Goles</Label>
                        <Input type="number" min="0" value={stats[player.player_id]?.goals || ''} onChange={(e) => setStats((prev) => ({ ...prev, [player.player_id]: { ...prev[player.player_id], goals: e.target.value } }))} className="h-10 bg-slate-50 text-center" disabled={!myRegistration} />
                      </div>
                      <div>
                        <Label className="text-xs">Asistencias</Label>
                        <Input type="number" min="0" value={stats[player.player_id]?.assists || ''} onChange={(e) => setStats((prev) => ({ ...prev, [player.player_id]: { ...prev[player.player_id], assists: e.target.value } }))} className="h-10 bg-slate-50 text-center" disabled={!myRegistration} />
                      </div>
                      <div>
                        <Label className="text-xs">Salvadas</Label>
                        <Input type="number" min="0" value={stats[player.player_id]?.saves || ''} onChange={(e) => setStats((prev) => ({ ...prev, [player.player_id]: { ...prev[player.player_id], saves: e.target.value } }))} className="h-10 bg-slate-50 text-center" disabled={!myRegistration} />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full rounded-xl text-xs"
                      onClick={() => submitStats(player.player_id)}
                      disabled={submitting === `stats-${player.player_id}` || !myRegistration}
                      data-testid={`submit-stats-${player.player_id}`}
                    >
                      <Send className="w-3 h-3 mr-1" /> Proponer
                    </Button>
                  </div>
                ))}

                <Link to={`/partidos/${id}/estadisticas`}>
                  <Button variant="outline" className="w-full rounded-xl" data-testid="go-to-stats-confirmation">
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
