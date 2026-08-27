import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import FootballPitch from '../components/FootballPitch';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Check, Shuffle, ArrowLeft, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, Edit3, Save, X, Loader2, AlertTriangle, Info, Users, CircleDashed, ShieldCheck, Swords, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';
import PositionBadge from '@/components/common/PositionBadge';
import { TEAM_COLORS } from '@/constants/matches';
import PhotoLightbox from '@/components/common/PhotoLightbox';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import Reveal from '@/components/common/Reveal';
import TeamPanel from '@/components/teams/TeamPanel';
import BalanceMeter from '@/components/teams/BalanceMeter';
import GenderSplit from '@/components/teams/GenderSplit';
import SectionHeading from '@/components/teams/SectionHeading';
import { identidadDeEquipo } from '@/components/teams/teamIdentity';

/**
 * El "volver" propio de la pagina, arriba del encabezado con foto.
 *
 * No usa el `volverA` de PageHeader porque el data-testid de este boton
 * (`back-to-match`) es el que usan los tests, y dos links de volver en la misma
 * pantalla es peor que uno bien puesto.
 */
const VOLVER_CHIP =
  'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2';

/** Chip para la banda del encabezado: va sobre foto, asi que blanco sobre vidrio oscuro. */
function HeaderChip({ children, testId }) {
  return (
    <span
      data-testid={testId}
      className="glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white"
    >
      {children}
    </span>
  );
}

function GeneratedTeamsSkeleton() {
  return (
    <div className="page-container max-w-5xl mx-auto" data-testid="generated-teams-skeleton">
      <div className="animate-pulse">
        <div className="h-11 w-40 bg-slate-100 rounded-full mb-4" />
        <div className="h-[150px] md:h-[190px] bg-slate-200 rounded-3xl mb-6" />
        <div className="flex gap-3 mb-6">
          <div className="h-11 w-32 bg-slate-200 rounded-full" />
          <div className="h-11 w-28 bg-slate-100 rounded-full" />
          <div className="h-11 w-32 bg-slate-100 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-pitch/20 rounded-3xl aspect-[2/3] md:aspect-[3/2]" />
          <div className="bg-pitch/20 rounded-3xl aspect-[2/3] md:aspect-[3/2]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-100 rounded-3xl border border-slate-100" />
          <div className="h-64 bg-slate-100 rounded-3xl border border-slate-100" />
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
    // Recarga cuando cambia lo que se mira, no cuando cambia la identidad de
    // la funcion — que se rehace en cada render. Igual que en los otros doce
    // efectos de carga de la app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const profileId = user?.profile_id || user?.profile?.id;
  const isOrganizer = Boolean(match && (match?.can_manage || match.organizer_id === profileId || user?.role === 'admin'));

  // Qué muestra esta pantalla lo decide el modo del partido. En el modo con DT
  // hay UN equipo — el nuestro — y un banco, y el rival es apenas un nombre: no
  // hay segundo plantel que dibujar ni balance que medir.
  const capacidades = match?.capabilities || {};
  const esDT = capacidades.opponent === 'externo';
  const tieneBanco = Boolean(capacidades.tiene_banco);
  const rival = match?.away_label || 'Rival';
  const nuestroEquipo = match?.home_label || 'Equipo A';

  const currentAssignments = editMode ? editAssignments : (teams?.assignments || []);
  const enBanco = (a) => tieneBanco && a.role === 'suplente';
  const teamA = currentAssignments.filter((a) => a.team === 'A' && !enBanco(a));
  const teamB = currentAssignments.filter((a) => a.team === 'B');
  const banco = currentAssignments.filter((a) => a.team === 'A' && enBanco(a));

  // La cancha dibuja por equipo, así que el banco no puede viajar en la lista:
  // aparecerían parados en el campo jugadores que arrancan afuera.
  const assignmentsEnCancha = tieneBanco
    ? currentAssignments.filter((a) => !enBanco(a))
    : currentAssignments;
  const availableFormations = teams?.available_formations || [];
  const teamSummaryA = teams?.team_summaries?.A;
  const teamSummaryB = teams?.team_summaries?.B;

  const formationChangedA = editMode && !!teams?.formation_a && editFormationA && editFormationA !== teams.formation_a;
  const formationChangedB = editMode && !!(teams?.formation_b || teams?.formation_a) && editFormationB && editFormationB !== (teams?.formation_b || teams?.formation_a);
  const slotsA = teams?.coords_a?.length || 0;
  const slotsB = teams?.coords_b?.length || teams?.coords_a?.length || 0;

  // Hay cancha cuando el backend mandó coordenadas, y no cuando la modalidad es
  // 11. Antes se comparaba `match.modality === 11` y por eso un F5 o un F7
  // nunca veían el dibujo aunque tuvieran formación: ahora la tienen todas las
  // modalidades, y quien decide es el dato, no un número escrito a mano.
  const tieneCancha = slotsA > 0;
  const incompleteA = slotsA > 0 && teamA.length < slotsA;
  const incompleteB = slotsB > 0 && teamB.length < slotsB;

  const handleSwapPlayer = (playerId) => {
    setEditAssignments((prev) => prev.map((a) => (
      a.player_id === playerId
        ? { ...a, team: a.team === 'A' ? 'B' : 'A', is_manual: true }
        : a
    )));
  };

  const handleToggleRole = (playerId) => {
    setEditAssignments((prev) => prev.map((a) => (
      a.player_id === playerId
        ? { ...a, role: a.role === 'suplente' ? 'titular' : 'suplente', is_manual: true }
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
  // Diferencia entre el mejor y el peor puntaje del plantel. Cuando es casi
  // cero, el balance esta calculado sobre jugadores que valen todos lo mismo y
  // el porcentaje no significa nada (ver BalanceMeter).
  const scoreSpread = teams?.score_spread;
  const balanceACiegas = typeof scoreSpread === 'number' && scoreSpread < 0.5;

  // Los chips del encabezado van sobre foto: el tono se marca con un punto de
  // color y el texto queda blanco, que es lo unico que llega a 4.5:1 ahi.
  // Los cortes acompañan a los del BalanceMeter, que bajaron cuando el backend
  // paso a medir brecha de promedios en vez de brecha de sumas.
  const balanceDotClass = balanceACiegas
    ? 'bg-slate-300'
    : balancePct >= 90
      ? 'bg-turf-light'
      : balancePct >= 75
        ? 'bg-orange-light'
        : 'bg-amber-300';

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
        <EmptyState
          variante={1}
          icono={Users}
          titulo="Todavía no hay equipos"
          descripcion="Generá los equipos desde el partido y acá vas a ver quién juega con quién, cómo quedaron paradas las dos formaciones y qué tan parejo salió el reparto."
          accion={(
            <Button
              data-testid="empty-back-to-match"
              onClick={() => navigate(`/partidos/${id}`)}
              shape="pill"
              className="bg-turf-btn hover:bg-turf-btn-dark text-white px-8"
            >
              Volver al partido
            </Button>
          )}
        />
      </div>
    );
  }

  const confirmado = teams.status === 'confirmado';

  const PlayerRow = ({ a, team }) => {
    const identidad = identidadDeEquipo(team);
    const destTeam = a.team === 'A' ? 'B' : 'A';
    return (
      <div
        className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors even:bg-slate-50/70 hover:bg-slate-100/80"
        data-testid={`team-player-${a.player_id}`}
      >
        <button
          type="button"
          onClick={() => openPlayerPhoto(a)}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
          aria-label={`Ver foto de ${a.player_name}`}
          data-testid={`view-team-player-photo-${a.player_id}`}
        >
          <Avatar className={`h-11 w-11 ring-2 ${identidad.aro}`}>
            <AvatarImage src={buildPhotoUrl(a.player_photo) || undefined} />
            <AvatarFallback className={`text-xs font-bold ${identidad.sobreColor}`} style={{ backgroundColor: identidad.color }}>
              {initialsFromName(a.player_name)}
            </AvatarFallback>
          </Avatar>
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{a.player_name}</p>
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
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <PositionBadge positionId={a.position} />
              {a.is_manual && (
                <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-semibold uppercase tracking-wide border-orange/40 text-orange-accessible">
                  Manual
                </Badge>
              )}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 tabular-nums">
                Valor {typeof a.player_score === 'number' ? a.player_score.toFixed(2) : '—'}
              </span>
              {a.player_age ? (
                <span className="text-[11px] text-slate-600 tabular-nums">{a.player_age} años</span>
              ) : null}
            </div>
          )}
        </div>

        {editMode && (tieneBanco ? (
          // Con banco el movimiento no es "al otro equipo" (no hay otro equipo):
          // es entrar al once o irse afuera.
          <Button
            size="sm"
            variant="ghost"
            className="h-11 w-11 min-h-11 min-w-11 p-0 shrink-0 text-slate-600 hover:text-turf-accessible hover:bg-turf/10 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
            onClick={() => handleToggleRole(a.player_id)}
            data-testid={`toggle-role-${a.player_id}`}
            title={a.role === 'suplente' ? 'Poner de titular' : 'Mandar al banco'}
            aria-label={
              a.role === 'suplente'
                ? `Poner a ${a.player_name} de titular`
                : `Mandar a ${a.player_name} al banco`
            }
          >
            {a.role === 'suplente'
              ? <ArrowUpFromLine className="w-4 h-4" />
              : <ArrowDownToLine className="w-4 h-4" />}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-11 w-11 min-h-11 min-w-11 p-0 shrink-0 text-slate-600 hover:text-turf-accessible hover:bg-turf/10 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
            onClick={() => handleSwapPlayer(a.player_id)}
            data-testid={`swap-player-${a.player_id}`}
            title={`Mover a Equipo ${destTeam}`}
            aria-label={`Mover a ${a.player_name} al equipo ${destTeam}`}
          >
            <ArrowRightLeft className="w-4 h-4" />
          </Button>
        ))}
      </div>
    );
  };

  /** Tira de numeros del equipo, arriba del plantel. Solo la ve el organizador. */
  const SummaryStrip = ({ summary }) => (
    <dl className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        ['Jugadores', summary.count],
        ['Valor total', summary.total_value?.toFixed?.(2) ?? summary.total_value],
        ['Valor medio', summary.average_value?.toFixed?.(2) ?? summary.average_value],
        ['Edad media', summary.average_age ?? '—'],
      ].map(([label, valor]) => (
        <div key={label} className="rounded-2xl bg-slate-50 px-3 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</dt>
          <dd className="font-heading text-xl font-bold text-slate-900 tabular-nums">{valor}</dd>
        </div>
      ))}
    </dl>
  );

  const canSeeSummaries = isOrganizer || user?.role === 'admin';

  const rosterPanel = (team, jugadores, summary, subtitulo = 'Plantel') => (
    <TeamPanel
      team={team}
      subtitulo={subtitulo}
      cantidad={jugadores.length}
      cantidadLabel={jugadores.length === 1 ? 'jugador' : 'jugadores'}
      testId={team === 'A' ? 'team-a-card' : 'team-b-card'}
    >
      {canSeeSummaries && summary && <SummaryStrip summary={summary} />}
      {jugadores.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-600">No hay jugadores en este equipo todavía.</p>
      ) : (
        <div className="-mx-2">
          {jugadores.map((a) => <PlayerRow key={a.player_id} a={a} team={team} />)}
        </div>
      )}
    </TeamPanel>
  );

  /**
   * El banco.
   *
   * Va en su propio panel y no como una sección del plantel porque es una
   * decisión del DT y se mira aparte: "quién arranca" y "quién tengo para
   * cambiar" son dos preguntas distintas.
   */
  const bancoPanel = (
    <section
      className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lift"
      data-testid="bench-card"
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange/10 text-orange-accessible"
          >
            <Users className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h3 className="font-heading text-base font-bold uppercase tracking-tight text-slate-900 sm:text-lg">
              El banco
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">
              {banco.length} {banco.length === 1 ? 'jugador' : 'jugadores'} para cambiar
            </p>
          </div>
        </div>
      </header>
      <div className="p-4 sm:p-5">
        <div className="-mx-2">
          {banco.map((a) => <PlayerRow key={a.player_id} a={a} team="A" />)}
        </div>
      </div>
    </section>
  );

  const pendingPitch = (team, formacion) => {
    const identidad = identidadDeEquipo(team);
    return (
      <div
        className="relative flex aspect-[2/3] flex-col items-center justify-center overflow-hidden rounded-3xl bg-pitch-dark p-6 text-center shadow-lift md:aspect-[3/2]"
        data-testid={`pitch-team-${team}-pending`}
      >
        <span aria-hidden="true" className="absolute inset-0 bg-pitch-stripes" />
        <div className="relative">
          <span
            className="mb-4 inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 ring-1 ring-white/25"
            style={{ backgroundColor: identidad.color }}
          >
            <span className={`grid h-6 w-6 place-items-center rounded-full bg-white/90 font-heading text-xs font-bold ${identidad.tinta}`} aria-hidden="true">
              {team}
            </span>
            <span className={`text-xs font-bold uppercase tracking-wider ${identidad.sobreColor}`}>Equipo {team}</span>
          </span>
          <Shuffle className="mx-auto mb-3 h-8 w-8 text-white" aria-hidden="true" />
          <p className="text-sm font-bold text-white">Formación cambiada a {formacion}</p>
          <p className="mt-1 text-xs text-white/85">La cancha se actualiza al guardar los cambios.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container max-w-5xl mx-auto" data-testid="generated-teams-page">
      <div className="animate-slide-up space-y-6">
        <button onClick={() => navigate(`/partidos/${id}`)} className={VOLVER_CHIP} data-testid="back-to-match">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver al partido
        </button>

        <PageHeader
          slug="equipos"
          eyebrow={esDT ? `Contra ${rival}` : 'Ya está sorteado'}
          titulo={esDT ? 'La alineación' : 'Equipos'}
          bajada={
            esDT
              ? 'Los que arrancan, los que esperan en el banco, y cómo se para el equipo en la cancha.'
              : 'Así quedaron los dos equipos. Mirá cómo se paran en la cancha y quién te toca de compañero.'
          }
          icono={Swords}
          testId="equipos-header"
          meta={(
            <>
              {/* El balance compara dos equipos. Con uno solo no significa nada,
                  así que no se muestra en vez de mostrar un 100% inventado. */}
              {!esDT && (
                <HeaderChip testId="balance-badge">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${balanceDotClass}`} />
                  {balanceACiegas ? 'Balance: sin datos' : `Balance: ${balancePct}%`}
                </HeaderChip>
              )}
              {esDT && banco.length > 0 && (
                <HeaderChip testId="bench-badge">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  {banco.length} en el banco
                </HeaderChip>
              )}
              {teams.formation_a && (
                <HeaderChip>
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                  Formación: {editMode ? editFormationA : teams.formation_a}
                </HeaderChip>
              )}
              <HeaderChip testId="teams-status-badge">
                {confirmado ? (
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {confirmado ? 'Confirmado' : 'Borrador'}
              </HeaderChip>
            </>
          )}
        />

        {isOrganizer && (
          <div className="rounded-3xl border border-slate-200 bg-mesh-turf bg-white p-4 shadow-lift">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
              {editMode ? 'Estás ajustando los equipos' : 'Organizás este partido'}
            </p>
            <div className="flex flex-wrap gap-3">
              {teams.status !== 'confirmado' && !editMode && (
                <>
                  <Button data-testid="confirm-teams-btn" onClick={handleConfirm} disabled={!!actionLoading} shape="pill" className="bg-turf-btn hover:bg-turf-btn-dark text-white px-6 shadow-lg shadow-turf/20 min-h-11">
                    {actionLoading === 'confirm' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />} Confirmar
                  </Button>
                  <Button data-testid="edit-teams-btn" variant="outline" shape="pill" onClick={() => setEditMode(true)} disabled={!!actionLoading} className="px-6 min-h-11 bg-white">
                    <Edit3 className="w-4 h-4 mr-2" /> Ajustar
                  </Button>
                  <Button data-testid="regenerate-teams-btn" variant="outline" shape="pill" onClick={handleRegenerate} disabled={!!actionLoading} className="px-6 min-h-11 bg-white">
                    {actionLoading === 'regenerate' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shuffle className="w-4 h-4 mr-2" />} {esDT ? 'Rearmar' : 'Recalcular'}
                  </Button>
                </>
              )}
              {editMode && (
                <>
                  <Button data-testid="save-adjustments-btn" onClick={handleSaveAdjustments} disabled={!!actionLoading} shape="pill" className="bg-turf-btn hover:bg-turf-btn-dark text-white px-6 shadow-lg shadow-turf/20 min-h-11">
                    {actionLoading === 'save' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
                  </Button>
                  <Button data-testid="cancel-edit-btn" variant="outline" shape="pill" onClick={cancelEdit} disabled={!!actionLoading} className="px-6 min-h-11 bg-white">
                    <X className="w-4 h-4 mr-2" /> Cancelar
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {editMode && (
          <div className="flex items-start gap-3 rounded-2xl border border-turf/25 bg-turf/5 px-4 py-3 text-sm text-slate-700" data-testid="edit-mode-hint">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-turf-accessible" aria-hidden="true" />
            {tieneBanco ? (
              <p>Tocá <ArrowDownToLine className="w-3.5 h-3.5 inline mx-0.5 align-text-top" aria-hidden="true" /> para mandar a un jugador al banco y <ArrowUpFromLine className="w-3.5 h-3.5 inline mx-0.5 align-text-top" aria-hidden="true" /> para meterlo en el once, o elegí su posición en el desplegable. No olvides <strong>Guardar Cambios</strong> al terminar.</p>
            ) : (
              <p>Tocá <ArrowRightLeft className="w-3.5 h-3.5 inline mx-0.5 align-text-top" aria-hidden="true" /> para mandar a un jugador al otro equipo, o elegí su posición en el desplegable. No olvides <strong>Guardar Cambios</strong> al terminar.</p>
            )}
          </div>
        )}

        {editMode && availableFormations.length > 0 && (
          <Card className="border-slate-200 rounded-3xl shadow-lift">
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Cambiar formación</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-600" htmlFor="formation-a-select">
                    {esDT ? nuestroEquipo : 'Equipo A'}
                  </label>
                  <Select value={editFormationA} onValueChange={setEditFormationA}>
                    <SelectTrigger id="formation-a-select" className="mt-1 h-11" data-testid="formation-a-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableFormations.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* El rival no está en la app: no tiene formación que elegir. */}
                {!esDT && (
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600" htmlFor="formation-b-select">Equipo B</label>
                    <Select value={editFormationB} onValueChange={setEditFormationB}>
                      <SelectTrigger id="formation-b-select" className="mt-1 h-11" data-testid="formation-b-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableFormations.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {tieneCancha && teams.formation_a && (
          <section className="space-y-4" data-testid="pitch-section">
            <SectionHeading
              icono={LayoutGrid}
              titulo="Cómo se paran"
              bajada={
                esDT
                  ? 'Los once que arrancan, cada uno en su puesto.'
                  : 'Los dos equipos con su formación. Cada jugador está en el puesto que le tocó.'
              }
            />
            <div className={esDT ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 gap-6 md:grid-cols-2'}>
              <div className="space-y-2">
                {incompleteA && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900" data-testid="incomplete-formation-a">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Formación incompleta: faltan {slotsA - teamA.length} jugador{slotsA - teamA.length === 1 ? '' : 'es'} en Equipo A.
                  </div>
                )}
                {formationChangedA ? pendingPitch('A', editFormationA) : (
                  <FootballPitch assignments={assignmentsEnCancha} formation={editMode ? editFormationA : teams.formation_a} coords={teams.coords_a} teamLabel="A" teamColor={TEAM_COLORS.A} />
                )}
              </div>
              {!esDT && (
              <div className="space-y-2">
                {incompleteB && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900" data-testid="incomplete-formation-b">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Formación incompleta: faltan {slotsB - teamB.length} jugador{slotsB - teamB.length === 1 ? '' : 'es'} en Equipo B.
                  </div>
                )}
                {formationChangedB ? pendingPitch('B', editFormationB) : (
                  <FootballPitch assignments={assignmentsEnCancha} formation={editMode ? (editFormationB || editFormationA) : (teams.formation_b || teams.formation_a)} coords={teams.coords_b || teams.coords_a} teamLabel="B" teamColor={TEAM_COLORS.B} />
                )}
              </div>
              )}
            </div>
          </section>
        )}

        {/* Las dos piezas de abajo comparan un equipo contra el otro. Con un
            solo plantel no hay nada que comparar. */}
        {!esDT && (teamSummaryA || teamSummaryB) && (
          <GenderSplit resumenA={teamSummaryA} resumenB={teamSummaryB} />
        )}

        {!esDT && canSeeSummaries && (teamSummaryA || teamSummaryB) && (
          <BalanceMeter
            pct={balancePct}
            valorA={typeof teamSummaryA?.total_value === 'number' ? teamSummaryA.total_value : undefined}
            valorB={typeof teamSummaryB?.total_value === 'number' ? teamSummaryB.total_value : undefined}
            spread={scoreSpread}
            testId="balance-meter"
          />
        )}

        <section className="space-y-4">
          <SectionHeading
            icono={Users}
            titulo={esDT ? 'El plantel' : 'Los planteles'}
            bajada={
              esDT
                ? 'Los que arrancan y los que esperan, con su puesto y su valor.'
                : 'Quién juega en cada equipo, con su puesto y su valor.'
            }
          />
          {esDT ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Reveal from="up">{rosterPanel('A', teamA, teamSummaryA, 'Titulares')}</Reveal>
              {banco.length > 0 && (
                <Reveal from="up" delay={100}>{bancoPanel}</Reveal>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Reveal from="up">{rosterPanel('A', teamA, teamSummaryA)}</Reveal>
              <Reveal from="up" delay={100}>{rosterPanel('B', teamB, teamSummaryB)}</Reveal>
            </div>
          )}
        </section>
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
