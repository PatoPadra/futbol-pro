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
import { Check, Shuffle, ArrowLeft, ArrowRightLeft, Edit3, Save, X, Loader2, AlertTriangle, Info, Users } from 'lucide-react';
import { toast } from 'sonner';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';
import PositionBadge from '@/components/common/PositionBadge';
import { TEAM_COLORS } from '@/constants/matches';
import PhotoLightbox from '@/components/common/PhotoLightbox';

function GeneratedTeamsSkeleton() {
  return (
    <div className="page-container max-w-5xl mx-auto" data-testid="generated-teams-skeleton">
      <div className="animate-pulse">
        <div className="h-4 w-32 bg-slate-100 rounded mb-4" />
        <div className="h-9 w-40 bg-slate-200 rounded-lg mb-3" />
        <div className="flex gap-2 mb-6">
          <div className="h-6 w-28 bg-slate-100 rounded-full" />
          <div className="h-6 w-24 bg-slate-100 rounded-full" />
        </div>
        <div className="flex gap-3 mb-6">
          <div className="h-11 w-32 bg-slate-200 rounded-full" />
          <div className="h-11 w-28 bg-slate-100 rounded-full" />
          <div className="h-11 w-32 bg-slate-100 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-pitch/20 rounded-xl aspect-[2/3] md:aspect-[3/2]" />
          <div className="bg-pitch/20 rounded-xl aspect-[2/3] md:aspect-[3/2]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-100 rounded-xl border border-slate-100" />
          <div className="h-64 bg-slate-100 rounded-xl border border-slate-100" />
        </div>
      </div>
    </div>
  );
}

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
  const [photoView, setPhotoView] = useState({ open: false, name: '', photoUrl: '', subtitle: '' });

  const openPlayerPhoto = (player) => {
    setPhotoView({
      open: true,
      name: player.player_name,
      photoUrl: player.player_photo,
      subtitle: player.position || 'Jugador',
    });
  };

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
        toast.error('No se han generado equipos aún');
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

  const formationChangedA = editMode && !!teams?.formation_a && editFormationA && editFormationA !== teams.formation_a;
  const formationChangedB = editMode && !!(teams?.formation_b || teams?.formation_a) && editFormationB && editFormationB !== (teams?.formation_b || teams?.formation_a);
  const slotsA = teams?.coords_a?.length || 0;
  const slotsB = teams?.coords_b?.length || teams?.coords_a?.length || 0;
  const incompleteA = is11 && slotsA > 0 && teamA.length < slotsA;
  const incompleteB = is11 && slotsB > 0 && teamB.length < slotsB;

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

  const balancePct = Math.round((teams?.balance_score || 0) * 100);
  const balanceToneClass = balancePct >= 85
    ? 'bg-turf/10 text-turf-accessible border-turf/20'
    : balancePct >= 70
      ? 'bg-orange/10 text-orange border-orange/20'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  const cancelEdit = () => {
    setEditMode(false);
    setEditAssignments(teams?.assignments || []);
    setEditFormationA(teams?.formation_a || '');
    setEditFormationB(teams?.formation_b || '');
  };

  if (loading) return <GeneratedTeamsSkeleton />;

  if (!teams) {
    return (
      <div className="page-container max-w-5xl mx-auto" data-testid="generated-teams-empty">
        <div className="animate-slide-up text-center py-20 rounded-3xl border border-dashed border-slate-200 bg-slate-50">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="font-heading text-2xl font-bold uppercase tracking-tight text-slate-700">Todavía no hay equipos</h2>
          <p className="text-slate-500 mt-1 mb-6">Generá los equipos desde el partido para poder verlos acá.</p>
          <Button
            data-testid="empty-back-to-match"
            onClick={() => navigate(`/partidos/${id}`)}
            className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase"
          >
            Volver al partido
          </Button>
        </div>
      </div>
    );
  }

  const PlayerRow = ({ a, teamColor }) => {
    const destTeam = a.team === 'A' ? 'B' : 'A';
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0" data-testid={`team-player-${a.player_id}`}>
        <button
          type="button"
          onClick={() => openPlayerPhoto(a)}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
          aria-label={`Ver foto de ${a.player_name}`}
          data-testid={`view-team-player-photo-${a.player_id}`}
        >
          <Avatar className="w-10 h-10">
            <AvatarImage src={buildPhotoUrl(a.player_photo) || undefined} />
            <AvatarFallback className="text-white text-xs font-bold" style={{ backgroundColor: teamColor }}>
              {initialsFromName(a.player_name)}
            </AvatarFallback>
          </Avatar>
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{a.player_name}</p>
          {editMode ? (
            <Select value={a.position} onValueChange={(v) => handleChangePosition(a.player_id, v)}>
              <SelectTrigger className="h-11 w-32 text-xs mt-1.5" data-testid={`position-select-${a.player_id}`}>
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
              <div className="flex items-center gap-1.5">
                <PositionBadge positionId={a.position} />
                {a.is_manual && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wide border-orange/30 text-orange">
                    Manual
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Valor {typeof a.player_score === 'number' ? a.player_score.toFixed(2) : '—'}
                {a.player_age ? ` · ${a.player_age} años` : ''}
              </p>
            </div>
          )}
        </div>

        {editMode && (
          <Button
            size="sm"
            variant="ghost"
            className="h-11 w-11 min-h-11 min-w-11 p-0 shrink-0 text-slate-400 hover:text-turf-accessible hover:bg-turf/10 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
            onClick={() => handleSwapPlayer(a.player_id)}
            data-testid={`swap-player-${a.player_id}`}
            title={`Mover a Equipo ${destTeam}`}
            aria-label={`Mover a ${a.player_name} al equipo ${destTeam}`}
          >
            <ArrowRightLeft className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  };

  const SummaryCard = ({ summary }) => (
    <Card className="border-slate-100 overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: TEAM_COLORS[summary.team] || TEAM_COLORS.A }} />
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
        <button onClick={() => navigate(`/partidos/${id}`)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 -ml-1 px-1 py-1" data-testid="back-to-match">
          <ArrowLeft className="w-4 h-4" /> Volver al partido
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">Equipos</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge className={`${balanceToneClass} font-semibold`} data-testid="balance-badge">
                Balance: {balancePct}%
              </Badge>
              {teams.formation_a && <Badge variant="outline">Formación: {editMode ? editFormationA : teams.formation_a}</Badge>}
              <Badge
                variant={teams.status === 'confirmado' ? 'default' : 'secondary'}
                className={teams.status === 'confirmado' ? 'bg-turf text-white' : 'bg-slate-100 text-slate-600'}
                data-testid="teams-status-badge"
              >
                {teams.status === 'confirmado' ? 'Confirmado' : 'Borrador'}
              </Badge>
            </div>
          </div>
        </div>

        {isOrganizer && (
          <div className="flex flex-wrap gap-3 mb-6">
            {teams.status !== 'confirmado' && !editMode && (
              <>
                <Button data-testid="confirm-teams-btn" onClick={handleConfirm} disabled={!!actionLoading} className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase shadow-lg shadow-turf/20 min-h-11">
                  {actionLoading === 'confirm' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />} Confirmar
                </Button>
                <Button data-testid="edit-teams-btn" variant="outline" onClick={() => setEditMode(true)} disabled={!!actionLoading} className="rounded-full px-6 min-h-11">
                  <Edit3 className="w-4 h-4 mr-2" /> Ajustar
                </Button>
                <Button data-testid="regenerate-teams-btn" variant="outline" onClick={handleRegenerate} disabled={!!actionLoading} className="rounded-full px-6 min-h-11">
                  {actionLoading === 'regenerate' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shuffle className="w-4 h-4 mr-2" />} Recalcular
                </Button>
              </>
            )}
            {editMode && (
              <>
                <Button data-testid="save-adjustments-btn" onClick={handleSaveAdjustments} disabled={!!actionLoading} className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase shadow-lg shadow-turf/20 min-h-11">
                  {actionLoading === 'save' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
                </Button>
                <Button data-testid="cancel-edit-btn" variant="outline" onClick={cancelEdit} disabled={!!actionLoading} className="rounded-full px-6 min-h-11">
                  <X className="w-4 h-4 mr-2" /> Cancelar
                </Button>
              </>
            )}
          </div>
        )}

        {editMode && (
          <div className="flex items-start gap-2 rounded-xl border border-turf/20 bg-turf/5 px-4 py-3 mb-6 text-sm text-slate-700" data-testid="edit-mode-hint">
            <Info className="w-4 h-4 text-turf-accessible shrink-0 mt-0.5" />
            <p>Tocá <ArrowRightLeft className="w-3 h-3 inline mx-0.5 align-text-top" /> para mandar a un jugador al otro equipo, o elegí su posición en el desplegable. No olvides <strong>Guardar Cambios</strong> al terminar.</p>
          </div>
        )}

        {editMode && is11 && availableFormations.length > 0 && (
          <Card className="border-slate-100 mb-6">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Cambiar formación</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500" htmlFor="formation-a-select">Equipo A</label>
                  <Select value={editFormationA} onValueChange={setEditFormationA}>
                    <SelectTrigger id="formation-a-select" className="mt-1 h-11" data-testid="formation-a-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableFormations.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500" htmlFor="formation-b-select">Equipo B</label>
                  <Select value={editFormationB} onValueChange={setEditFormationB}>
                    <SelectTrigger id="formation-b-select" className="mt-1 h-11" data-testid="formation-b-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableFormations.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {is11 && teams.formation_a && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8" data-testid="pitch-section">
            <div>
              {incompleteA && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-2 text-xs text-amber-800" data-testid="incomplete-formation-a">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Formación incompleta: faltan {slotsA - teamA.length} jugador{slotsA - teamA.length === 1 ? '' : 'es'} en Equipo A.
                </div>
              )}
              {formationChangedA ? (
                <div className="relative bg-pitch rounded-xl overflow-hidden border-4 border-white/20 shadow-inner aspect-[2/3] md:aspect-[3/2] flex flex-col items-center justify-center text-center p-6" data-testid="pitch-team-A-pending">
                  <Shuffle className="w-8 h-8 text-white/70 mb-3" />
                  <p className="text-white font-semibold text-sm">Formación cambiada a {editFormationA}</p>
                  <p className="text-white/70 text-xs mt-1">La cancha se actualiza al guardar los cambios.</p>
                </div>
              ) : (
                <FootballPitch assignments={currentAssignments} formation={editMode ? editFormationA : teams.formation_a} coords={teams.coords_a} teamLabel="A" teamColor={TEAM_COLORS.A} />
              )}
            </div>
            <div>
              {incompleteB && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-2 text-xs text-amber-800" data-testid="incomplete-formation-b">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Formación incompleta: faltan {slotsB - teamB.length} jugador{slotsB - teamB.length === 1 ? '' : 'es'} en Equipo B.
                </div>
              )}
              {formationChangedB ? (
                <div className="relative bg-pitch rounded-xl overflow-hidden border-4 border-white/20 shadow-inner aspect-[2/3] md:aspect-[3/2] flex flex-col items-center justify-center text-center p-6" data-testid="pitch-team-B-pending">
                  <Shuffle className="w-8 h-8 text-white/70 mb-3" />
                  <p className="text-white font-semibold text-sm">Formación cambiada a {editFormationB}</p>
                  <p className="text-white/70 text-xs mt-1">La cancha se actualiza al guardar los cambios.</p>
                </div>
              ) : (
                <FootballPitch assignments={currentAssignments} formation={editMode ? (editFormationB || editFormationA) : (teams.formation_b || teams.formation_a)} coords={teams.coords_b || teams.coords_a} teamLabel="B" teamColor={TEAM_COLORS.B} />
              )}
            </div>
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
          <Card className="border-slate-100 overflow-hidden" data-testid="team-a-card">
            <div className="h-1.5" style={{ backgroundColor: TEAM_COLORS.A }} />
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: TEAM_COLORS.A }} /> Equipo A ({teamA.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teamA.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No hay jugadores en este equipo todavía.</p>
              ) : (
                teamA.map((a) => <PlayerRow key={a.player_id} a={a} teamColor={TEAM_COLORS.A} />)
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-100 overflow-hidden" data-testid="team-b-card">
            <div className="h-1.5" style={{ backgroundColor: TEAM_COLORS.B }} />
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: TEAM_COLORS.B }} /> Equipo B ({teamB.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teamB.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No hay jugadores en este equipo todavía.</p>
              ) : (
                teamB.map((a) => <PlayerRow key={a.player_id} a={a} teamColor={TEAM_COLORS.B} />)
              )}
            </CardContent>
          </Card>
        </div>
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
