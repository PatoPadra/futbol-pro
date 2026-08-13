import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  Play,
  RefreshCw,
  Share2,
  Shuffle,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { MODALITY_LABELS, MATCH_STATUS_BADGE_CLASS, MATCH_STATUS_LABELS } from '@/constants/matches';
import RegistrationCard from '@/components/matches/RegistrationCard';
import AddGuestDialog from '@/components/matches/AddGuestDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PILL_BTN = 'rounded-full font-bold uppercase tracking-wider transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2';

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

function MatchDetailSkeleton() {
  return (
    <div className="page-container max-w-5xl mx-auto" data-testid="match-detail-skeleton">
      <div className="animate-pulse space-y-6">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-7 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-3 flex-1 min-w-[200px]">
              <div className="h-5 w-24 bg-slate-100 rounded-full" />
              <div className="h-10 w-3/4 bg-slate-200 rounded-lg" />
              <div className="h-4 w-40 bg-slate-100 rounded" />
            </div>
            <div className="h-11 w-32 bg-slate-100 rounded-full" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl border border-slate-100" />
            ))}
          </div>
        </div>
        <div className="h-16 bg-slate-100 rounded-xl border border-slate-100" />
        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.95fr] gap-6 items-start">
          <div className="space-y-6">
            <div className="h-64 bg-slate-100 rounded-xl border border-slate-100" />
            <div className="h-40 bg-slate-100 rounded-xl border border-slate-100" />
          </div>
          <div className="h-72 bg-slate-100 rounded-xl border border-slate-100" />
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
            <Users className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="font-heading text-2xl font-bold uppercase tracking-tight text-slate-900 mb-2">
            Partido no encontrado
          </h2>
          <p className="text-slate-500 mb-6 max-w-sm">
            Puede que haya sido borrado o que el enlace esté mal escrito.
          </p>
          <Link to="/partidos">
            <Button data-testid="back-to-matches-btn" className={`${PILL_BTN} h-11 px-8 bg-turf hover:bg-turf-dark text-white shadow-lg shadow-turf/20`}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver a partidos
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
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="font-heading text-2xl font-bold uppercase tracking-tight text-slate-900 mb-2">
            No pudimos cargar el partido
          </h2>
          <p className="text-slate-500 mb-6 max-w-sm">
            Revisá tu conexión a internet e intentá de nuevo.
          </p>
          <Button
            onClick={() => loadData()}
            data-testid="match-detail-retry-btn"
            className={`${PILL_BTN} h-11 px-8 bg-turf hover:bg-turf-dark text-white shadow-lg shadow-turf/20`}
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const spotsLeft = match.max_players - titulars.length;
  const isFull = spotsLeft <= 0;
  const deadlinePassed = Boolean(match.deadline) && new Date() > new Date(match.deadline);
  const deadlineLabel = formatDeadline(match.deadline);

  const primaryAction = (() => {
    if (match.status === 'abierto' && !isRegistered) {
      if (deadlinePassed) {
        return {
          label: 'Inscripción cerrada',
          icon: XCircle,
          disabled: true,
          className: 'bg-slate-200 text-slate-500 pointer-events-none',
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
        className: 'bg-slate-900 hover:bg-slate-800 text-white',
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
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>
        Como organizador podés quitar jugadores del partido. Si quitás un titular, sube automáticamente el primer suplente.
      </span>
    </div>
  );

  return (
    <div className="page-container max-w-5xl mx-auto" data-testid="match-detail-page">
      <div className="animate-slide-up space-y-6">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-7 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Badge className={`text-xs font-semibold border ${MATCH_STATUS_BADGE_CLASS[match.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {MATCH_STATUS_LABELS[match.status] || match.status}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {MODALITY_LABELS[match.modality] || `Fútbol ${match.modality}`}
                </Badge>
                {match.group_name ? <Badge variant="outline">Grupo: {match.group_name}</Badge> : null}
              </div>

              <h1 className="font-heading text-4xl md:text-5xl font-bold uppercase tracking-tight">
                {match.title}
              </h1>

              <p className="text-sm text-slate-500 mt-2">
                Organizado por {match.organizer_name}
              </p>

              {match.status === 'abierto' && deadlineLabel && (
                <p className={`text-sm mt-1 flex items-center gap-1.5 ${deadlinePassed ? 'text-red-600 font-semibold' : 'text-slate-500'}`} data-testid="registration-deadline">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  {deadlinePassed ? `La inscripción cerró el ${deadlineLabel} hs` : `Inscripción abierta hasta el ${deadlineLabel} hs`}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleShareWhatsApp}
                className={`${PILL_BTN} h-11 border-2 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 focus-visible:ring-green-500`}
                data-testid="share-whatsapp-btn"
              >
                <Share2 className="w-4 h-4 mr-2" /> Compartir
              </Button>

              {isOrganizer && (
                <Button
                  variant="outline"
                  onClick={handleDuplicate}
                  disabled={!!actionLoading}
                  className={`${PILL_BTN} h-11 border-2 border-slate-200 hover:border-slate-400`}
                  data-testid="duplicate-match-btn"
                >
                  {actionLoading === 'duplicate' ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Duplicando...
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" /> Duplicar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {match.status === 'cancelado' && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2" data-testid="match-cancelled-banner">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Este partido fue cancelado. Ya no admite nuevas inscripciones ni acciones deportivas, pero sigue visible en el historial.</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <Card className="border-slate-100 shadow-none">
              <CardContent className="p-4 flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Fecha</p>
                  <p className="font-semibold text-slate-900">{match.date}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-100 shadow-none">
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Hora</p>
                  <p className="font-semibold text-slate-900">{match.time}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-100 shadow-none">
              <CardContent className="p-4 flex items-center gap-3">
                <MapPin className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Lugar</p>
                  <p className="font-semibold text-slate-900 truncate">{match.location}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-100 shadow-none">
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Titulares</p>
                  <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                    {titulars.length}/{match.max_players}
                    {isFull && <Badge className="text-[10px] px-1.5 py-0 bg-slate-900 text-white border-0">Completo</Badge>}
                  </p>
                  {suplentes.length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">+{suplentes.length} suplente{suplentes.length === 1 ? '' : 's'}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {match.maps_link && (
            <a
              href={match.maps_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm text-turf-accessible font-medium hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
              data-testid="maps-link"
            >
              <ExternalLink className="w-4 h-4" />
              Ver ubicación en el mapa
            </a>
          )}
        </section>

        {primaryAction && (
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Acción principal</p>
                <p className="font-semibold text-slate-900">
                  {primaryAction.description || 'Resolvé lo importante de este partido desde acá'}
                </p>
              </div>

              {'to' in primaryAction ? (
                <Link to={primaryAction.to}>
                  <Button className={`${PILL_BTN} h-11 px-6 ${primaryAction.className}`} data-testid={primaryAction.testId}>
                    <primaryAction.icon className="w-4 h-4 mr-2" />
                    {primaryAction.label}
                  </Button>
                </Link>
              ) : (
                <Button
                  onClick={primaryAction.onClick}
                  disabled={!!actionLoading || match.status === 'cancelado' || !!primaryAction.disabled}
                  variant={primaryAction.variant || 'default'}
                  className={`${PILL_BTN} h-11 px-6 ${primaryAction.className}`}
                  data-testid={primaryAction.testId}
                >
                  <primaryAction.icon className="w-4 h-4 mr-2" />
                  {primaryAction.label}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className={isOrganizer ? 'grid grid-cols-1 xl:grid-cols-[1.25fr_0.95fr] gap-6 items-start' : 'grid grid-cols-1 gap-6 items-start'}>
          <div className="space-y-6">
            {['equipos_generados', 'equipos_confirmados'].includes(match.status) && (
              <Card className="border-slate-100 shadow-sm">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">Equipos</p>
                    <p className="font-semibold text-slate-900">
                      {match.status === 'equipos_confirmados' ? 'Los equipos ya están confirmados' : 'Los equipos ya fueron generados'}
                    </p>
                  </div>
                  <Link to={`/partidos/${id}/equipos`}>
                    <Button
                      variant="outline"
                      className={`${PILL_BTN} h-11 px-6 border-2 border-slate-200 hover:border-slate-400`}
                      data-testid="view-teams-btn"
                    >
                      Ver equipos
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {canEditRegistrations && <ManagementNotice />}

            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-turf" />
                      Titulares ({titulars.length}/{match.max_players})
                    </CardTitle>
                    {titulars.length > 0 && <p className="text-sm text-slate-500 mt-1">Tocá la foto para verla más grande.</p>}
                  </div>
                  {canAddGuest && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAddGuestOpen(true)}
                      className="rounded-full border-2 border-slate-200 hover:border-turf hover:text-turf-accessible shrink-0 h-9"
                      data-testid="open-add-guest-dialog"
                    >
                      <UserPlus className="w-4 h-4 mr-1.5" /> Agregar invitado
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {titulars.length === 0 ? (
                  <div className="py-6 text-center">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">
                      {match.status === 'abierto' ? 'Todavía nadie se anotó. ¡Sé el primero!' : 'Sin titulares aún'}
                    </p>
                  </div>
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
              </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange" />
                  Suplentes ({suplentes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {suplentes.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">Sin suplentes</p>
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
              </CardContent>
            </Card>
          </div>

          {isOrganizer && (
            <div className="space-y-6">
              <Card className="border-slate-100 shadow-sm xl:sticky xl:top-20">
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-lg uppercase">Acciones del organizador</CardTitle>
                  <p className="text-sm text-slate-500">Bloque secundario para gestión y limpieza del partido.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {match.status === 'abierto' && (
                    <Button
                      variant="outline"
                      onClick={handleClose}
                      disabled={!!actionLoading}
                      className={`${PILL_BTN} w-full h-11 border-2 border-slate-200 hover:border-slate-400`}
                      data-testid="secondary-close-registrations"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      {actionLoading === 'close' ? 'Cerrando...' : 'Cerrar inscripciones'}
                    </Button>
                  )}

                  {['cerrado', 'equipos_generados'].includes(match.status) && (
                    <Button
                      onClick={handleGenerateTeams}
                      disabled={!!actionLoading}
                      className={`${PILL_BTN} w-full h-11 bg-orange hover:bg-orange-light text-white shadow-lg shadow-orange/20`}
                      data-testid="secondary-generate-teams"
                    >
                      <Shuffle className="w-4 h-4 mr-2" />
                      {actionLoading === 'generate' ? 'Generando...' : (match.status === 'equipos_generados' ? 'Recalcular equipos' : 'Generar equipos')}
                    </Button>
                  )}

                  {match.status === 'equipos_confirmados' && (
                    <Button
                      onClick={handleFinalize}
                      disabled={!!actionLoading}
                      className={`${PILL_BTN} w-full h-11 bg-slate-900 hover:bg-slate-800 text-white`}
                      data-testid="secondary-finalize-match"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {actionLoading === 'finalize' ? 'Finalizando...' : 'Finalizar partido'}
                    </Button>
                  )}

                  {match.status !== 'cancelado' && !['finalizado', 'completado'].includes(match.status) && (
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={!!actionLoading}
                      className={`${PILL_BTN} w-full h-11 border-2 border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 focus-visible:ring-amber-500`}
                      data-testid="cancel-match-btn"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      {actionLoading === 'cancel' ? 'Cancelando...' : 'Cancelar partido'}
                    </Button>
                  )}

                  {canDelete && (
                    <Button
                      variant="outline"
                      onClick={handleDelete}
                      disabled={!!actionLoading}
                      className={`${PILL_BTN} w-full h-11 border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 focus-visible:ring-red-500`}
                      data-testid="delete-match-btn"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {actionLoading === 'delete' ? 'Borrando...' : 'Borrar definitivamente'}
                    </Button>
                  )}

                  {!canDelete && ['cancelado', 'finalizado', 'completado'].includes(match.status) && (
                    <p className="text-sm text-slate-400 text-center py-2">No hay más acciones disponibles para este partido.</p>
                  )}
                </CardContent>
              </Card>
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
