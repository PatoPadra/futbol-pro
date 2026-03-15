import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Slider } from '../components/ui/slider';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, Star, Send } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

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

  const profileId = user?.profile_id || user?.profile?.id;

  useEffect(() => {
    const load = async () => {
      try {
        const [regsRes, ratingsRes] = await Promise.all([
          api.get(`/matches/${id}/registrations`),
          api.get(`/matches/${id}/ratings`),
        ]);
        setRegistrations(regsRes.data);
        setExistingRatings(ratingsRes.data);
        if (ratingsRes.data?.my_ratings?.length) {
          const rMap = {};
          ratingsRes.data.my_ratings.forEach(r => { rMap[r.rated_player_id] = r.score; });
          setRatings(rMap);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const otherPlayers = registrations.filter(r => r.player_id !== profileId && r.status === 'titular');

  const submitRatings = async () => {
    const ratingsList = Object.entries(ratings).map(([pid, score]) => ({
      rated_player_id: pid, score: parseInt(score),
    }));
    if (ratingsList.length === 0) { toast.error('Evalua al menos un jugador'); return; }
    setSubmitting('ratings');
    try {
      await api.post(`/matches/${id}/ratings`, { ratings: ratingsList });
      toast.success('Evaluaciones guardadas!');
    } catch (err) { toast.error('Error al guardar evaluaciones'); }
    finally { setSubmitting(''); }
  };

  const submitSelfEval = async () => {
    setSubmitting('self');
    try {
      await api.post(`/matches/${id}/self-evaluation`, selfEval);
      toast.success('Autoevaluacion guardada');
    } catch (err) { toast.error('Error'); }
    finally { setSubmitting(''); }
  };

  const submitStats = async (playerId) => {
    const s = stats[playerId];
    if (!s) return;
    setSubmitting('stats');
    try {
      await api.post(`/matches/${id}/stats/propose`, {
        player_id: playerId,
        goals: parseInt(s.goals) || 0,
        assists: parseInt(s.assists) || 0,
        saves: parseInt(s.saves) || 0,
      });
      toast.success('Estadisticas propuestas');
    } catch (err) { toast.error('Error'); }
    finally { setSubmitting(''); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="page-container max-w-3xl mx-auto" data-testid="post-match-page">
      <div className="animate-slide-up">
        <button onClick={() => navigate(`/partidos/${id}`)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4" data-testid="back-to-match-post">
          <ArrowLeft className="w-4 h-4" /> Volver al partido
        </button>

        <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight mb-2">Post Partido</h1>
        <p className="text-slate-500 mb-6">Evalua a tus companeros y propone estadisticas.</p>

        <Tabs defaultValue="evaluaciones" className="space-y-6">
          <TabsList className="w-full grid grid-cols-3 h-12 bg-slate-100 rounded-xl">
            <TabsTrigger value="evaluaciones" className="rounded-lg font-semibold text-sm" data-testid="tab-evaluaciones">Evaluaciones</TabsTrigger>
            <TabsTrigger value="autoevaluacion" className="rounded-lg font-semibold text-sm" data-testid="tab-autoevaluacion">Autoevaluacion</TabsTrigger>
            <TabsTrigger value="estadisticas" className="rounded-lg font-semibold text-sm" data-testid="tab-estadisticas">Estadisticas</TabsTrigger>
          </TabsList>

          {/* Peer Evaluations */}
          <TabsContent value="evaluaciones">
            <Card className="border-slate-100">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-lg uppercase">Evalua a tus companeros</CardTitle>
                <p className="text-xs text-slate-500">Puntuacion del 1 al 10</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {otherPlayers.map(p => (
                  <div key={p.player_id} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0" data-testid={`rate-player-${p.player_id}`}>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={p.player_photo ? `${API_URL}${p.player_photo}` : undefined} />
                      <AvatarFallback className="bg-turf/10 text-turf text-xs font-bold">{p.player_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.player_name}</p>
                      <Slider
                        min={1} max={10} step={1}
                        value={[ratings[p.player_id] || 5]}
                        onValueChange={v => setRatings(prev => ({ ...prev, [p.player_id]: v[0] }))}
                        className="mt-2"
                      />
                    </div>
                    <span className="text-lg font-bold text-turf w-8 text-center">{ratings[p.player_id] || 5}</span>
                  </div>
                ))}
                <Button
                  data-testid="submit-ratings-btn"
                  onClick={submitRatings}
                  disabled={submitting === 'ratings'}
                  className="w-full bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase"
                >
                  <Star className="w-4 h-4 mr-2" /> {existingRatings?.has_rated ? 'Actualizar Evaluaciones' : 'Guardar Evaluaciones'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Self Evaluation */}
          <TabsContent value="autoevaluacion">
            <Card className="border-slate-100">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-lg uppercase">Tu autoevaluacion</CardTitle>
                <p className="text-xs text-slate-500">Solo vos podes ver esto. No afecta tu rating.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Puntuacion: {selfEval.score}</Label>
                  <Slider
                    min={1} max={10} step={1}
                    value={[selfEval.score]}
                    onValueChange={v => setSelfEval(p => ({ ...p, score: v[0] }))}
                    className="mt-3"
                  />
                </div>
                <div>
                  <Label>Notas (opcional)</Label>
                  <textarea
                    data-testid="self-eval-notes"
                    value={selfEval.notes}
                    onChange={e => setSelfEval(p => ({ ...p, notes: e.target.value }))}
                    className="mt-1.5 w-full h-24 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm resize-none focus:border-turf focus:ring-2 focus:ring-turf/20"
                    placeholder="Como sentis que jugaste hoy?"
                  />
                </div>
                <Button data-testid="submit-self-eval" onClick={submitSelfEval} disabled={submitting === 'self'} className="w-full bg-slate-800 text-white rounded-xl font-bold uppercase">
                  Guardar Autoevaluacion
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats */}
          <TabsContent value="estadisticas">
            <Card className="border-slate-100">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-lg uppercase">Proponer Estadisticas</CardTitle>
                <p className="text-xs text-slate-500">Las estadisticas se confirman por votacion de los jugadores.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {registrations.filter(r => r.status === 'titular').map(p => (
                  <div key={p.player_id} className="border border-slate-100 rounded-xl p-4" data-testid={`stats-player-${p.player_id}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={p.player_photo ? `${API_URL}${p.player_photo}` : undefined} />
                        <AvatarFallback className="bg-turf/10 text-turf text-xs font-bold">{p.player_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{p.player_name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Goles</Label>
                        <Input
                          type="number" min="0"
                          value={stats[p.player_id]?.goals || ''}
                          onChange={e => setStats(prev => ({ ...prev, [p.player_id]: { ...prev[p.player_id], goals: e.target.value } }))}
                          className="h-10 bg-slate-50 text-center"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Asistencias</Label>
                        <Input
                          type="number" min="0"
                          value={stats[p.player_id]?.assists || ''}
                          onChange={e => setStats(prev => ({ ...prev, [p.player_id]: { ...prev[p.player_id], assists: e.target.value } }))}
                          className="h-10 bg-slate-50 text-center"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Salvadas</Label>
                        <Input
                          type="number" min="0"
                          value={stats[p.player_id]?.saves || ''}
                          onChange={e => setStats(prev => ({ ...prev, [p.player_id]: { ...prev[p.player_id], saves: e.target.value } }))}
                          className="h-10 bg-slate-50 text-center"
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full rounded-lg text-xs"
                      onClick={() => submitStats(p.player_id)}
                      disabled={submitting === 'stats'}
                      data-testid={`submit-stats-${p.player_id}`}
                    >
                      <Send className="w-3 h-3 mr-1" /> Proponer
                    </Button>
                  </div>
                ))}
                <Link to={`/partidos/${id}/estadisticas`}>
                  <Button variant="outline" className="w-full rounded-xl" data-testid="go-to-stats-confirmation">
                    Ver estado de confirmacion
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
