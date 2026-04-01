import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import FootballPitch from '../components/FootballPitch';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Check, Shuffle, ArrowLeft, ArrowRightLeft, Edit3, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';

export default function GeneratedTeams() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState(null);
  const [match, setMatch] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editAssignments, setEditAssignments] = useState([]);
  const [editFormationA, setEditFormationA] = useState('');
  const [editFormationB, setEditFormationB] = useState('');

  const loadData = async () => {
    try {
      const [teamsRes, matchRes, posRes] = await Promise.all([
        api.get(`/matches/${id}/teams`),
        api.get(`/matches/${id}`),
        api.get('/positions'),
      ]);
      setTeams(teamsRes.data);
      setMatch(matchRes.data);
      setPositions(posRes.data || []);
      setEditAssignments(teamsRes.data.assignments || []);
      setEditFormationA(teamsRes.data.formation_a || '');
      setEditFormationB(teamsRes.data.formation_b || '');
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('No se han generado equipos aun');
        navigate(`/partidos/${id}`);
      } else {
        toast.error(err.response?.data?.detail || 'No se pudieron cargar los equipos');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const profileId = user?.profile_id || user?.profile?.id;
  const isOrganizer = Boolean(match && (match?.can_manage || match.organizer_id === profileId || user?.role === 'admin'));

  const currentAssignments = editMode ? editAssignments : (teams?.assignments || []);
  const teamA = currentAssignments.filter((a) => a.team === 'A');
  const teamB = currentAssignments.filter((a) => a.team === 'B');
  const is11 = match?.modality === 11;
  const availableFormations = teams?.available_formations || [];
  const teamSummaryA = teams?.team_summaries?.A;
  const teamSummaryB = teams?.team_summaries?.B;

  const handleSwapPlayer = (playerId) => {
    setEditAssignments((prev) => prev.map((a) => (
      a.player_id === playerId
        ? { ...a, team: a.team === 'A' ? 'B' : 'A', is_manual: true }
        : a
    )));
  };

  const handleChangePosition = (playerId, newPos) => {
    setEditAssignments((prev) => prev.map((a) => (
      a.player_id === playerId
        ? { ...a, position: newPos, is_manual: true }
        : a
    )));
  };

  const handleSaveAdjustments = async () => {
    setActionLoading('save');
    try {
      await api.put(`/matches/${id}/teams`, {
        assignments: editAssignments,
        formation_a: editFormationA || null,
        formation_b: editFormationB || null,
      });
      toast.success('Equipos ajustados');
      setEditMode(false);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setActionLoading('');
    }
  };

  const handleConfirm = async () => {
    setActionLoading('confirm');
    try {
      await api.post(`/matches/${id}/teams/confirm`);
      toast.success('Equipos confirmados');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setActionLoading('');
    }
  };

  const handleRegenerate = async () => {
    setActionLoading('regenerate');
    try {
      await api.post(`/matches/${id}/generate-teams`);
      toast.success('Equipos recalculados');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setActionLoading('');
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditAssignments(teams?.assignments || []);
    setEditFormationA(teams?.formation_a || '');
    setEditFormationB(teams?.formation_b || '');
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" /></div>;
  if (!teams) return null;

  const PlayerRow = ({ a, teamColor }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0" data-testid={`team-player-${a.player_id}`}>
      <Avatar className="w-9 h-9">
        <AvatarImage src={buildPhotoUrl(a.player_photo) || undefined} />
        <AvatarFallback className="text-white text-xs font-bold" style={{ backgroundColor: teamColor }}>
          {initialsFromName(a.player_name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{a.player_name}</p>
        {editMode ? (
          <Select value={a.position} onValueChange={(v) => handleChangePosition(a.player_id, v)}>
            <SelectTrigger className="h-7 w-28 text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
              <SelectItem value="JUG" className="text-xs">Jugador</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="space-y-0.5">
            <p className="text-xs text-slate-400">{a.position}{a.is_manual ? ' (manual)' : ''}</p>
            <p className="text-[11px] text-slate-500">
              Valor {typeof a.player_score === 'number' ? a.player_score.toFixed(2) : '—'}
              {a.player_age ? ` · ${a.player_age} anios` : ''}
            </p>
          </div>
        )}
      </div>

      {editMode && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-slate-400 hover:text-turf"
          onClick={() => handleSwapPlayer(a.player_id)}
          data-testid={`swap-player-${a.player_id}`}
        >
          <ArrowRightLeft className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  const SummaryCard = ({ summary }) => (
    <Card className="border-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-lg uppercase">Resumen Equipo {summary.team}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Jugadores</p>
            <p className="text-xl font-bold text-slate-900">{summary.count}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Valor total</p>
            <p className="text-xl font-bold text-slate-900">{summary.total_value?.toFixed?.(2) ?? summary.total_value}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Valor medio</p>
            <p className="text-xl font-bold text-slate-900">{summary.average_value?.toFixed?.(2) ?? summary.average_value}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Edad media</p>
            <p className="text-xl font-bold text-slate-900">{summary.average_age ?? '—'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="page-container max-w-5xl mx-auto" data-testid="generated-teams-page">
      <div className="animate-slide-up">
        <button onClick={() => navigate(`/partidos/${id}`)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4" data-testid="back-to-match">
          <ArrowLeft className="w-4 h-4" /> Volver al partido
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">Equipos</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge className="bg-turf/10 text-turf border-turf/20 font-semibold">
                Balance: {(teams.balance_score * 100).toFixed(0)}%
              </Badge>
              {teams.formation_a && <Badge variant="outline">Formacion: {editMode ? editFormationA : teams.formation_a}</Badge>}
              <Badge variant={teams.status === 'confirmado' ? 'default' : 'secondary'} className={teams.status === 'confirmado' ? 'bg-turf text-white' : ''}>
                {teams.status === 'confirmado' ? 'Confirmado' : 'Borrador'}
              </Badge>
            </div>
          </div>
        </div>

        {isOrganizer && (
          <div className="flex flex-wrap gap-3 mb-6">
            {teams.status !== 'confirmado' && !editMode && (
              <>
                <Button data-testid="confirm-teams-btn" onClick={handleConfirm} disabled={!!actionLoading} className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase">
                  <Check className="w-4 h-4 mr-2" /> Confirmar
                </Button>
                <Button data-testid="edit-teams-btn" variant="outline" onClick={() => setEditMode(true)} className="rounded-full px-6">
                  <Edit3 className="w-4 h-4 mr-2" /> Ajustar
                </Button>
                <Button data-testid="regenerate-teams-btn" variant="outline" onClick={handleRegenerate} disabled={!!actionLoading} className="rounded-full px-6">
                  <Shuffle className="w-4 h-4 mr-2" /> Recalcular
                </Button>
              </>
            )}
            {editMode && (
              <>
                <Button data-testid="save-adjustments-btn" onClick={handleSaveAdjustments} disabled={!!actionLoading} className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase">
                  <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                </Button>
                <Button data-testid="cancel-edit-btn" variant="outline" onClick={cancelEdit} className="rounded-full px-6">
                  <X className="w-4 h-4 mr-2" /> Cancelar
                </Button>
              </>
            )}
          </div>
        )}

        {editMode && is11 && availableFormations.length > 0 && (
          <Card className="border-slate-100 mb-6">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Cambiar formacion</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500">Equipo A</label>
                  <Select value={editFormationA} onValueChange={setEditFormationA}>
                    <SelectTrigger className="mt-1" data-testid="formation-a-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableFormations.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500">Equipo B</label>
                  <Select value={editFormationB} onValueChange={setEditFormationB}>
                    <SelectTrigger className="mt-1" data-testid="formation-b-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableFormations.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {is11 && teams.formation_a && !editMode && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <FootballPitch assignments={currentAssignments} formation={teams.formation_a} coords={teams.coords_a} teamLabel="A" teamColor="#1A1D23" />
            <FootballPitch assignments={currentAssignments} formation={teams.formation_b || teams.formation_a} coords={teams.coords_b || teams.coords_a} teamLabel="B" teamColor="#FF6B00" />
          </div>
        )}

        {(isOrganizer || user?.role === 'admin') && (teamSummaryA || teamSummaryB) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {[teamSummaryA, teamSummaryB].filter(Boolean).map((summary) => (
              <SummaryCard key={summary.team} summary={summary} />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-slate-800" /> Equipo A ({teamA.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teamA.map((a) => <PlayerRow key={a.player_id} a={a} teamColor="#1A1D23" />)}
            </CardContent>
          </Card>

          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange" /> Equipo B ({teamB.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teamB.map((a) => <PlayerRow key={a.player_id} a={a} teamColor="#FF6B00" />)}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
