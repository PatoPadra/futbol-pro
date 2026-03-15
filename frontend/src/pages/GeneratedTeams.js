import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import FootballPitch from '../components/FootballPitch';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Check, Shuffle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function GeneratedTeams() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState(null);
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  const loadData = async () => {
    try {
      const [teamsRes, matchRes] = await Promise.all([
        api.get(`/matches/${id}/teams`),
        api.get(`/matches/${id}`),
      ]);
      setTeams(teamsRes.data);
      setMatch(matchRes.data);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('No se han generado equipos aun');
        navigate(`/partidos/${id}`);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [id]);

  const profileId = user?.profile_id || user?.profile?.id;
  const isOrganizer = match && (match.organizer_id === profileId || user?.role === 'admin');
  const teamA = teams?.assignments?.filter(a => a.team === 'A') || [];
  const teamB = teams?.assignments?.filter(a => a.team === 'B') || [];
  const sumA = teamA.reduce((s, a) => s + (a.score || 0), 0);
  const sumB = teamB.reduce((s, a) => s + (a.score || 0), 0);

  const handleConfirm = async () => {
    setActionLoading('confirm');
    try {
      await api.post(`/matches/${id}/teams/confirm`);
      toast.success('Equipos confirmados!');
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
    finally { setActionLoading(''); }
  };

  const handleRegenerate = async () => {
    setActionLoading('regenerate');
    try {
      await api.post(`/matches/${id}/generate-teams`);
      toast.success('Equipos recalculados');
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
    finally { setActionLoading(''); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" /></div>;
  if (!teams) return null;

  const is11 = match?.modality === 11;

  return (
    <div className="page-container max-w-5xl mx-auto" data-testid="generated-teams-page">
      <div className="animate-slide-up">
        <button onClick={() => navigate(`/partidos/${id}`)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4" data-testid="back-to-match">
          <ArrowLeft className="w-4 h-4" /> Volver al partido
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">Equipos</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge className="bg-turf/10 text-turf border-turf/20 font-semibold">
                Balance: {(teams.balance_score * 100).toFixed(0)}%
              </Badge>
              {teams.formation_a && (
                <Badge variant="outline">Formacion: {teams.formation_a}</Badge>
              )}
              <Badge variant={teams.status === 'confirmado' ? 'default' : 'secondary'} className={teams.status === 'confirmado' ? 'bg-turf text-white' : ''}>
                {teams.status === 'confirmado' ? 'Confirmado' : 'Borrador'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Actions */}
        {isOrganizer && teams.status !== 'confirmado' && (
          <div className="flex flex-wrap gap-3 mb-6">
            <Button data-testid="confirm-teams-btn" onClick={handleConfirm} disabled={!!actionLoading} className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase">
              <Check className="w-4 h-4 mr-2" /> Confirmar Equipos
            </Button>
            <Button data-testid="regenerate-teams-btn" variant="outline" onClick={handleRegenerate} disabled={!!actionLoading} className="rounded-full px-6">
              <Shuffle className="w-4 h-4 mr-2" /> Recalcular
            </Button>
          </div>
        )}

        {/* Pitch Visualization (11v11) */}
        {is11 && teams.formation_a && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <FootballPitch
              assignments={teams.assignments}
              formation={teams.formation_a}
              coords={teams.coords_a}
              teamLabel="A"
              teamColor="#1A1D23"
            />
            <FootballPitch
              assignments={teams.assignments}
              formation={teams.formation_b || teams.formation_a}
              coords={teams.coords_b || teams.coords_a}
              teamLabel="B"
              teamColor="#FF6B00"
            />
          </div>
        )}

        {/* Team Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-slate-800" /> Equipo A
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teamA.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0" data-testid={`team-a-player-${i}`}>
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={a.player_photo ? `${API_URL}${a.player_photo}` : undefined} />
                    <AvatarFallback className="bg-slate-800 text-white text-xs font-bold">{a.player_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.player_name}</p>
                    <p className="text-xs text-slate-400">{a.position}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange" /> Equipo B
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teamB.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0" data-testid={`team-b-player-${i}`}>
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={a.player_photo ? `${API_URL}${a.player_photo}` : undefined} />
                    <AvatarFallback className="bg-orange text-white text-xs font-bold">{a.player_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.player_name}</p>
                    <p className="text-xs text-slate-400">{a.position}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
