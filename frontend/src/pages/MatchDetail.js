import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ClipboardList,
  Clock,
  Copy,
  ExternalLink,
  Info,
  LayoutGrid,
  MapPin,
  Play,
  RefreshCw,
  Settings2,
  Share2,
  Shuffle,
  Trash2,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { MODALITY_LABELS, MATCH_STATUS_LABELS } from '@/constants/matches';
import RegistrationCard from '@/components/matches/RegistrationCard';
import AddGuestDialog from '@/components/matches/AddGuestDialog';
import Panel from '@/components/matches/Panel';
import MetaChip from '@/components/matches/MetaChip';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const formatDeadline = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const formatted = d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return formatted;
  } catch {
    return null;
  }
};

/**
 * Tono del chip de estado dentro del encabezado (sobre foto, texto blanco).
 * Los tonos de `MATCH_STATUS_BADGE_CLASS` están calibrados para fondo claro y
 * sobre el scrim no se leen, así que acá se mapea a los tonos de MetaChip.
 * El texto del estado siempre está escrito: el color no es la única señal.
 */
const ESTADO_TONO = {
  abierto: 'turf',
  cerrado: 'orange',
  equipos_generados: 'orange',
  equipos_confirmados: 'neutro',
  finalizado: 'apagado',
  completado: 'apagado',
  cancelado: 'alerta',
};

/** Dato del partido: ícono en chip, etiqueta chica arriba, valor en negrita. */
function DatoTile({ icono: Icono, etiqueta, children, testId }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3"
      data-testid={testId}
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-turf/10 text-turf-accessible"
      >
        <Icono className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">{etiqueta}</p>
        <div className="font-semibold text-slate-900">{children}</div>
      </div>
    </div>
  );
}

function MatchDetailSkeleton() {
  return (
    <div className="page-container max-w-5xl mx-auto" data-testid="match-detail-skeleton">
      <div className="animate-pulse space-y-6">
        <div className="h-[150px] rounded-3xl bg-slate-200 md:h-[190px]" />
        <div className="h-20 rounded-3xl border border-slate-100 bg-slate-100" />
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.95fr] gap-6 items-start">
          <div className="space-y-6">
            <div className="h-48 rounded-3xl border border-slate-100 bg-slate-100" />
            <div className="h-64 rounded-3xl border border-slate-100 bg-slate-100" />
            <div className="h-40 rounded-3xl border border-slate-100 bg-slate-100" />
          </div>
          <div className="h-72 rounded-3xl border border-slate-100 bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export default function MatchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [loadError, setLoadError] = useState(null); // 'not_found' | 'error' | null
  const [addGuestOpen, setAddGuestOpen] = useState(false);

  const loadData = async ({ keepLoader = false } = {}) => {
    if (!keepLoader) setLoading(true);
    setLoadError(null);
    try {
      const [matchRes, regsRes] = await Promise.all([
        api.get(`/matches/${id}`),
        api.get(`/matches/${id}/registrations`),
      ]);
      setMatch(matchRes.data);
      setRegistrations(regsRes.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cargar partido');
      setLoadError(err.response?.status === 404 ? 'not_found' : 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const profileId = user?.profile_id || user?.profile?.id;
  const isOrganizer = Boolean(match?.can_manage || match?.organizer_id === profileId || match?.my_group_role === 'organizador' || user?.role === 'admin');
  const isRegistered = Boolean(match?.my_registration);
  const canDelete = Boolean(match?.can_delete || user?.role === 'admin');

  const titulars = useMemo(() => registrations.filter((r) => r.status === 'titular'), [registrations]);
  const suplentes = useMemo(() => registrations.filter((r) => r.status === 'suplente'), [registrations]);
  const canEditRegistrations = isOrganizer && !['finalizado', 'completado', 'cancelado'].includes(match?.status);
  const registeredPlayerIds = useMemo(() => new Set(registrations.map((r) => r.player_id)), [registrations]);
  const canAddGuest = isOrganizer && match?.status === 'abierto';

  const runAction = async (key, action, successMessage, { reload = true, onSuccess } = {}) => {
    setActionLoading(key);
    try {
      const response = await action();
      const resolvedMessage = successMessage || response?.data?.message;
      if (resolvedMessage) toast.success(resolvedMessage);
      if (reload) await loadData({ keepLoader: true });
      if (onSuccess) onSuccess(response);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setActionLoading('');
    }
  };

  const handleRegister = () => runAction('register', () => api.post(`/matches/${id}/register`), 'Te anotaste');
  const handleUnregister = () => runAction('unregister', () => api.delete(`/matches/${id}/register`), 'Te diste de baja');
  const handleClose = () => runAction('close', () => api.post(`/matches/${id}/close`), 'Inscripciones cerradas');
  const handleGenerateTeams = () => runAction('generate', () => api.post(`/matches/${id}/generate-teams`), 'Equipos generados', { reload: false, onSuccess: () => navigate(`/partidos/${id}/equipos`) });
  const handleFinalize = () => runAction('finalize', () => api.post(`/matches/${id}/finalize`), 'Partido finalizado');
  const handleDuplicate = () => runAction('duplicate', () => api.post(`/matches/${id}/duplicate`), null, { reload: false, onSuccess: (response) => {
    toast.success(response.data.message);
    navigate(`/partidos/${response.data.id}`);
  }});

  const handleCancel = async () => {
    const confirmed = window.confirm('¿Querés cancelar este partido? Los jugadores seguirán existiendo, pero el partido pasará a estado cancelado.');
    if (!confirmed) return;
    await runAction('cancel', () => api.post(`/matches/${id}/cancel`), 'Partido cancelado');
  };

  const handleDelete = async () => {
    const confirmed = window.confirm('¿Querés borrar definitivamente este partido? Esta acción elimina inscripciones, estadísticas y equipos generados.');
    if (!confirmed) return;
    await runAction('delete', () => api.delete(`/matches/${id}`), 'Partido borrado', { reload: false, onSuccess: () => navigate('/partidos') });
  };

  const handleRemoveRegistration = async (registration) => {
    const confirmed = window.confirm(`¿Querés quitar a ${registration.player_name} de este partido?`);
    if (!confirmed) return;

    await runAction(
      `remove-${registration.id}`,
      () => api.delete(`/matches/${id}/registrations/${registration.id}`),
      null
    );
  };

  const handleShareWhatsApp = () => {
    const url = window.location.href;
    const lines = [
      match.title,
      `${match.date} a las ${match.time}`,
      match.location,
      `Titulares: ${titulars.length}/${match.max_players}`,
      '',
      `Anotate acá: ${url}`,
    ];
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <MatchDetailSkeleton />;

  if (loadError === 'not_found') {
    return (
      <div className="page-container" data-testid="match-not-found">
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-slate-600" aria-hidden="true" />
          </div>
          <h2 className="font-heading text-2xl font-bold uppercase tracking-tight text-slate-900 mb-2">
            Partido no encontrado
          </h2>
          <p className="text-slate-600 mb-6 max-w-sm">
            Puede que haya sido borrado o que el enlace esté mal escrito.
          </p>
          <Link to="/partidos" className="rounded-full focus-visible:outline-none">
            <Button data-testid="back-to-matches-btn" shape="pill" className="h-11 px-8 bg-turf hover:bg-turf-dark text-white shadow-lg shadow-turf/20">
              <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" /> Volver a partidos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loadError === 'error' || !match) {
    return (
      <div className="page-container" data-testid="match-detail-error">
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" aria-hidden="true" />
          </div>
          <h2 className="font-heading text-2xl font-bold uppercase tracking-tight text-slate-900 mb-2">
            No pudimos cargar el partido
          </h2>
          <p className="text-slate-600 mb-6 max-w-sm">
            Revisá tu conexión a internet e intentá de nuevo.
          </p>
          <Button
            onClick={() => loadData()}
            data-testid="match-detail-retry-btn"
            shape="pill"
            className="h-11 px-8 bg-turf hover:bg-turf-dark text-white shadow-lg shadow-turf/20"
          >
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const spotsLeft = match.max_players - titulars.length;
  const isFull = spotsLeft <= 0;
  const deadlinePassed = Boolean(match.deadline) && new Date() > new Date(match.deadline);
  const deadlineLabel = formatDeadline(match.deadline);
  const fillPct = match.max_players
    ? Math.min(100, Math.round((titulars.length / match.max_players) * 100))
    : 0;

  const primaryAction = (() => {
    if (match.status === 'abierto' && !isRegistered) {
      if (deadlinePassed) {
        return {
          label: 'Inscripción cerrada',
          icon: XCircle,
          disabled: true,
          className: 'bg-slate-200 text-slate-600 pointer-events-none',
          testId: 'registration-closed-notice',
          description: 'El plazo de inscripción venció. Esperá a que el organizador cierre el partido o abra uno nuevo.',
        };
      }
      return {
        label: actionLoading === 'register' ? 'Anotando...' : 'Anotarme',
        icon: UserPlus,
        onClick: handleRegister,
        className: 'bg-turf hover:bg-turf-dark text-white shadow-lg shadow-turf/20',
        testId: 'register-for-match',
        description: isFull
          ? `No quedan lugares de titular: te anotás como suplente #${suplentes.length + 1}`
          : `Quedan ${spotsLeft} ${spotsLeft === 1 ? 'lugar' : 'lugares'} de titular`,
      };
    }
    if (match.status === 'abierto' && isRegistered) {
      return {
        label: actionLoading === 'unregister' ? 'Dándote de baja...' : 'Darme de baja',
        icon: UserMinus,
        onClick: handleUnregister,
        className: 'border-2 border-red-200 text-red-600 hover:bg-red-50 focus-visible:ring-red-500',
        variant: 'outline',
        testId: 'unregister-from-match',
        description: 'Ya estás anotado para este partido. ¡Nos vemos en la cancha!',
      };
    }
    if (isOrganizer && match.status === 'abierto') {
      return {
        label: actionLoading === 'close' ? 'Cerrando...' : 'Cerrar inscripciones',
        icon: XCircle,
        onClick: handleClose,
        className: 'border-2 border-slate-200 hover:border-slate-400',
        variant: 'outline',
        testId: 'close-registrations',
        description: deadlinePassed
          ? 'El plazo de inscripción ya venció: cerrala para poder armar los equipos.'
          : `Inscripción abierta hasta ${deadlineLabel || 'el día del partido'}`,
      };
    }
    if (isOrganizer && ['cerrado', 'equipos_generados'].includes(match.status)) {
      return {
        label: actionLoading === 'generate' ? 'Generando...' : (match.status === 'equipos_generados' ? 'Recalcular equipos' : 'Generar equipos'),
        icon: Shuffle,
        onClick: handleGenerateTeams,
        className: 'bg-orange hover:bg-orange-light text-white shadow-lg shadow-orange/20',
        testId: 'generate-teams-btn',
        description: 'Armamos equipos balanceados automáticamente con los jugadores anotados.',
      };
    }
    if (isOrganizer && match.status === 'equipos_confirmados') {
      return {
        label: actionLoading === 'finalize' ? 'Finalizando...' : 'Finalizar partido',
        icon: Play,
        onClick: handleFinalize,
        className: 'bg-secondary text-secondary-foreground',
        testId: 'finalize-match-btn',
        description: 'Marcá el partido como jugado para habilitar estadísticas y evaluaciones.',
      };
    }
    if (match.status === 'finalizado' && isRegistered) {
      return {
        label: 'Evaluar y estadísticas',
        icon: Play,
        to: `/partidos/${id}/post-partido`,
        className: 'bg-orange hover:bg-orange-light text-white shadow-lg shadow-orange/20',
        testId: 'post-match-btn',
        description: 'Cargá goles, asistencias y calificá a tus compañeros de partido.',
      };
    }
    return null;
  })();

  const ManagementNotice = () => (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        Como organizador podés quitar jugadores del partido. Si quitás un titular, sube automáticamente el primer suplente.
      </span>
    </div>
  );

  return (
    <div className="page-container max-w-5xl mx-auto" data-testid="match-detail-page">
      <div className="animate-slide-up space-y-6">
        <PageHeader
          slug="partido"
          eyebrow={match.group_name ? `Grupo ${match.group_name}` : 'Partido'}
          titulo={match.title}
          bajada={`Organizado por ${match.organizer_name}`}
          volverA="/partidos"
          volverLabel="Partidos"
          icono={Trophy}
          testId="match-detail-header"
          meta={
            <>
              <MetaChip tono={ESTADO_TONO[match.status] || 'neutro'} punto>
                {MATCH_STATUS_LABELS[match.status] || match.status}
              </MetaChip>
              <MetaChip icono={Calendar}>{match.date}</MetaChip>
              <MetaChip icono={Clock}>{match.time} hs</MetaChip>
              <MetaChip icono={MapPin} className="max-w-[220px]">{match.location}</MetaChip>
              <MetaChip icono={Users}>
                {MODALITY_LABELS[match.modality] || `Fútbol ${match.modality}`}
              </MetaChip>
            </>
          }
          acciones={
            <>
              <Button
                variant="outline"
                onClick={handleShareWhatsApp}
                shape="pill"
                className="h-11 border-2 border-white/45 bg-slate-950/45 text-white backdrop-blur-sm hover:border-white hover:bg-slate-950/70 hover:text-white focus-visible:ring-white focus-visible:ring-offset-transparent"
                data-testid="share-whatsapp-btn"
              >
                <Share2 className="w-4 h-4 mr-2" aria-hidden="true" /> Compartir
              </Button>

              {isOrganizer && (
                <Button
                  variant="outline"
                  onClick={handleDuplicate}
                  disabled={!!actionLoading}
                  shape="pill"
                  className="h-11 border-2 border-white/45 bg-slate-950/45 text-white backdrop-blur-sm hover:border-white hover:bg-slate-950/70 hover:text-white focus-visible:ring-white focus-visible:ring-offset-transparent"
                  data-testid="duplicate-match-btn"
                >
                  {actionLoading === 'duplicate' ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Duplicando...
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" aria-hidden="true" /> Duplicar
                    </>
                  )}
                </Button>
              )}
            </>
          }
        />

        {match.status === 'cancelado' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2" data-testid="match-cancelled-banner">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>Este partido fue cancelado. Ya no admite nuevas inscripciones ni acciones deportivas, pero sigue visible en el historial.</span>
          </div>
        )}

        {match.status === 'abierto' && deadlineLabel && (
          <div
            className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
              deadlinePassed
                ? 'border-amber-200 bg-amber-50 font-semibold text-amber-900'
                : 'border-slate-200/80 bg-white text-slate-600 shadow-sm'
            }`}
            data-testid="registration-deadline"
          >
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {deadlinePassed
                ? `La inscripción cerró el ${deadlineLabel} hs`
                : `Inscripción abierta hasta el ${deadlineLabel} hs`}
            </span>
          </div>
        )}

        {primaryAction && (
          <section className="overflow-hidden rounded-3xl border border-turf/20 bg-mesh-turf bg-white shadow-lift">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-turf/15 text-turf-accessible"
                >
                  <Zap className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-turf-accessible">
                    Lo que sigue
                  </p>
                  <p className="mt-0.5 font-semibold text-slate-900">
                    {primaryAction.description || 'Resolvé lo importante de este partido desde acá'}
                  </p>
                </div>
              </div>

              {'to' in primaryAction ? (
                <Link to={primaryAction.to} className="shrink-0 rounded-full focus-visible:outline-none">
                  <Button shape="pill" className={`h-11 w-full px-6 sm:w-auto ${primaryAction.className}`} data-testid={primaryAction.testId}>
                    <primaryAction.icon className="w-4 h-4 mr-2" aria-hidden="true" />
                    {primaryAction.label}
                  </Button>
                </Link>
              ) : primaryAction.disabled ? (
                <div
                  className="flex shrink-0 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900"
                  data-testid={primaryAction.testId}
                >
                  <primaryAction.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {primaryAction.label}
                </div>
              ) : (
                <Button
                  onClick={primaryAction.onClick}
                  disabled={!!actionLoading || match.status === 'cancelado'}
                  variant={primaryAction.variant || 'default'}
                  shape="pill"
                  className={`h-11 shrink-0 px-6 ${primaryAction.className}`}
                  data-testid={primaryAction.testId}
                >
                  <primaryAction.icon className="w-4 h-4 mr-2" aria-hidden="true" />
                  {primaryAction.label}
                </Button>
              )}
            </div>
          </section>
        )}

        <div className={isOrganizer ? 'grid grid-cols-1 lg:grid-cols-[1.25fr_0.95fr] gap-6 items-start' : 'grid grid-cols-1 gap-6 items-start'}>
          <div className="space-y-6">
            <Panel
              icono={Info}
              titulo="La info del partido"
              bajada="Dónde, cuándo y con cuánta gente."
              tono="turf"
              testId="match-info-panel"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DatoTile icono={Calendar} etiqueta="Fecha">{match.date}</DatoTile>
                <DatoTile icono={Clock} etiqueta="Hora">{match.time} hs</DatoTile>
                <DatoTile icono={MapPin} etiqueta="Lugar">
                  <span className="block truncate">{match.location}</span>
                </DatoTile>
                <DatoTile icono={Users} etiqueta="Titulares">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-heading text-lg tabular-nums">
                      {titulars.length}/{match.max_players}
                    </span>
                    {isFull && (
                      <Badge variant="charcoal" className="min-h-0 px-2 py-0.5 text-[10px] font-bold uppercase">
                        Completo
                      </Badge>
                    )}
                  </span>
                  {suplentes.length > 0 && (
                    <span className="block text-xs font-normal text-slate-600">
                      +{suplentes.length} suplente{suplentes.length === 1 ? '' : 's'}
                    </span>
                  )}
                </DatoTile>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Cupo de titulares</span>
                  <span className="tabular-nums">
                    {isFull
                      ? 'Sin lugares libres'
                      : `${spotsLeft} ${spotsLeft === 1 ? 'lugar libre' : 'lugares libres'}`}
                  </span>
                </div>
                <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${isFull ? 'bg-slate-900' : 'bg-turf'}`}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </div>

              {match.maps_link && (
                <a
                  href={match.maps_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-1 text-sm font-semibold text-turf-accessible hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                  data-testid="maps-link"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  Ver ubicación en el mapa
                </a>
              )}
            </Panel>

            {['equipos_generados', 'equipos_confirmados'].includes(match.status) && (
              <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange/10 text-orange-accessible"
                    >
                      <LayoutGrid className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">Equipos</p>
                      <p className="mt-0.5 font-semibold text-slate-900">
                        {match.status === 'equipos_confirmados' ? 'Los equipos ya están confirmados' : 'Los equipos ya fueron generados'}
                      </p>
                    </div>
                  </div>
                  <Link to={`/partidos/${id}/equipos`} className="shrink-0 rounded-full focus-visible:outline-none">
                    <Button
                      variant="outline"
                      shape="pill"
                      className="h-11 w-full px-6 border-2 border-slate-200 hover:border-slate-400 sm:w-auto"
                      data-testid="view-teams-btn"
                    >
                      Ver equipos
                    </Button>
                  </Link>
                </div>
              </section>
            )}

            {canEditRegistrations && <ManagementNotice />}

            <Panel
              icono={ClipboardList}
              titulo="Titulares"
              contador={`${titulars.length}/${match.max_players}`}
              bajada={titulars.length > 0 ? 'Tocá la foto para verla más grande.' : undefined}
              tono="turf"
              testId="titulars-panel"
              contentClassName="space-y-3 p-4 sm:p-5"
              acciones={
                canAddGuest ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddGuestOpen(true)}
                    shape="pill"
                    className="h-11 shrink-0 border-2 border-slate-200 hover:border-turf hover:text-turf-accessible"
                    data-testid="open-add-guest-dialog"
                  >
                    <UserPlus className="w-4 h-4 mr-1.5" aria-hidden="true" /> Agregar invitado
                  </Button>
                ) : null
              }
            >
              {titulars.length === 0 ? (
                <EmptyState
                  variante={2}
                  icono={Users}
                  titulo={match.status === 'abierto' ? 'Todavía nadie se anotó' : 'Sin titulares'}
                  descripcion={
                    match.status === 'abierto'
                      ? '¡Sé el primero! El que abre la lista siempre juega.'
                      : 'Este partido quedó sin jugadores anotados como titulares.'
                  }
                  testId="titulars-empty"
                />
              ) : (
                titulars.map((registration, index) => (
                  <RegistrationCard
                    key={registration.id}
                    registration={registration}
                    index={index}
                    canManage={canEditRegistrations && actionLoading !== `remove-${registration.id}`}
                    onRemove={() => handleRemoveRegistration(registration)}
                  />
                ))
              )}
            </Panel>

            <Panel
              icono={Users}
              titulo="Suplentes"
              contador={suplentes.length}
              bajada={suplentes.length > 0 ? 'Entran por orden si se cae un titular.' : undefined}
              tono="orange"
              testId="suplentes-panel"
              contentClassName="space-y-3 p-4 sm:p-5"
            >
              {suplentes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
                  <p className="text-sm text-slate-600">
                    Todavía no hay suplentes. Cuando se llene el cupo, los que se anoten van a esperar acá.
                  </p>
                </div>
              ) : (
                suplentes.map((registration, index) => (
                  <RegistrationCard
                    key={registration.id}
                    registration={registration}
                    index={index}
                    canManage={canEditRegistrations && actionLoading !== `remove-${registration.id}`}
                    onRemove={() => handleRemoveRegistration(registration)}
                  />
                ))
              )}
            </Panel>
          </div>

          {isOrganizer && (
            <div className="space-y-6">
              <Panel
                icono={Settings2}
                titulo="Acciones del organizador"
                bajada="Gestión y limpieza del partido."
                tono="slate"
                testId="organizer-actions-panel"
                className="lg:sticky lg:top-20"
                contentClassName="space-y-3 p-4 sm:p-5"
              >
                {match.status === 'abierto' && (
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={!!actionLoading}
                    shape="pill"
                    className="w-full h-11 border-2 border-slate-200 hover:border-slate-400"
                    data-testid="secondary-close-registrations"
                  >
                    <XCircle className="w-4 h-4 mr-2" aria-hidden="true" />
                    {actionLoading === 'close' ? 'Cerrando...' : 'Cerrar inscripciones'}
                  </Button>
                )}

                {['cerrado', 'equipos_generados'].includes(match.status) && (
                  <Button
                    onClick={handleGenerateTeams}
                    disabled={!!actionLoading}
                    shape="pill"
                    className="w-full h-11 bg-orange hover:bg-orange-light text-white shadow-lg shadow-orange/20"
                    data-testid="secondary-generate-teams"
                  >
                    <Shuffle className="w-4 h-4 mr-2" aria-hidden="true" />
                    {actionLoading === 'generate' ? 'Generando...' : (match.status === 'equipos_generados' ? 'Recalcular equipos' : 'Generar equipos')}
                  </Button>
                )}

                {match.status === 'equipos_confirmados' && (
                  <Button
                    onClick={handleFinalize}
                    disabled={!!actionLoading}
                    shape="pill"
                    className="w-full h-11 bg-secondary text-secondary-foreground"
                    data-testid="secondary-finalize-match"
                  >
                    <Play className="w-4 h-4 mr-2" aria-hidden="true" />
                    {actionLoading === 'finalize' ? 'Finalizando...' : 'Finalizar partido'}
                  </Button>
                )}

                {match.status !== 'cancelado' && !['finalizado', 'completado'].includes(match.status) && (
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={!!actionLoading}
                    shape="pill"
                    className="w-full h-11 border-2 border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 focus-visible:ring-amber-500"
                    data-testid="cancel-match-btn"
                  >
                    <XCircle className="w-4 h-4 mr-2" aria-hidden="true" />
                    {actionLoading === 'cancel' ? 'Cancelando...' : 'Cancelar partido'}
                  </Button>
                )}

                {canDelete && (
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    disabled={!!actionLoading}
                    shape="pill"
                    className="w-full h-11 border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 focus-visible:ring-red-500"
                    data-testid="delete-match-btn"
                  >
                    <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                    {actionLoading === 'delete' ? 'Borrando...' : 'Borrar definitivamente'}
                  </Button>
                )}

                {!canDelete && ['cancelado', 'finalizado', 'completado'].includes(match.status) && (
                  <p className="text-sm text-slate-600 text-center py-2">No hay más acciones disponibles para este partido.</p>
                )}
              </Panel>
            </div>
          )}
        </div>
      </div>

      {canAddGuest && (
        <AddGuestDialog
          open={addGuestOpen}
          onOpenChange={setAddGuestOpen}
          matchId={id}
          groupId={match.group_id}
          registeredPlayerIds={registeredPlayerIds}
          onRegistered={() => loadData({ keepLoader: true })}
        />
      )}
    </div>
  );
}
