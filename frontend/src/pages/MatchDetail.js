import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  Play,
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
import PageLoader from '@/components/common/PageLoader';
import RegistrationCard from '@/components/matches/RegistrationCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MatchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  const loadData = async ({ keepLoader = false } = {}) => {
    if (!keepLoader) setLoading(true);
    try {
      const [matchRes, regsRes] = await Promise.all([
        api.get(`/matches/${id}`),
        api.get(`/matches/${id}/registrations`),
      ]);
      setMatch(matchRes.data);
      setRegistrations(regsRes.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cargar partido');
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
    const text = `${match.title}%0A${match.date} a las ${match.time}%0A${match.location}%0ATitulares: ${titulars.length}/${match.max_players}%0A%0AAnotate aca: ${url}`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) return <PageLoader />;
  if (!match) return <div className="page-container text-center text-slate-500">Partido no encontrado</div>;

  const primaryAction = (() => {
    if (match.status === 'abierto' && !isRegistered) {
      return {
        label: actionLoading === 'register' ? 'Anotando...' : 'Anotarme',
        icon: UserPlus,
        onClick: handleRegister,
        className: 'bg-turf hover:bg-turf-dark text-white',
        testId: 'register-for-match',
      };
    }
    if (match.status === 'abierto' && isRegistered) {
      return {
        label: actionLoading === 'unregister' ? 'Dándote de baja...' : 'Darme de baja',
        icon: UserMinus,
        onClick: handleUnregister,
        className: 'border-red-200 text-red-600 hover:bg-red-50',
        variant: 'outline',
        testId: 'unregister-from-match',
      };
    }
    if (isOrganizer && match.status === 'abierto') {
      return {
        label: actionLoading === 'close' ? 'Cerrando...' : 'Cerrar inscripciones',
        icon: XCircle,
        onClick: handleClose,
        className: 'border-slate-200',
        variant: 'outline',
        testId: 'close-registrations',
      };
    }
    if (isOrganizer && ['cerrado', 'equipos_generados'].includes(match.status)) {
      return {
        label: actionLoading === 'generate' ? 'Generando...' : (match.status === 'equipos_generados' ? 'Recalcular equipos' : 'Generar equipos'),
        icon: Shuffle,
        onClick: handleGenerateTeams,
        className: 'bg-orange hover:bg-orange-light text-white',
        testId: 'generate-teams-btn',
      };
    }
    if (isOrganizer && match.status === 'equipos_confirmados') {
      return {
        label: actionLoading === 'finalize' ? 'Finalizando...' : 'Finalizar partido',
        icon: Play,
        onClick: handleFinalize,
        className: 'bg-slate-900 hover:bg-slate-800 text-white',
        testId: 'finalize-match-btn',
      };
    }
    if (match.status === 'finalizado' && isRegistered) {
      return {
        label: 'Evaluar y estadísticas',
        icon: Play,
        to: `/partidos/${id}/post-partido`,
        className: 'bg-orange hover:bg-orange-light text-white',
        testId: 'post-match-btn',
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
                  {MODALITY_LABELS[match.modality] || `Futbol ${match.modality}`}
                </Badge>
                {match.group_name ? <Badge variant="outline">Grupo: {match.group_name}</Badge> : null}
              </div>

              <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">
                {match.title}
              </h1>

              <p className="text-sm text-slate-500 mt-2">
                Organizado por {match.organizer_name}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleShareWhatsApp}
                className="rounded-full border-green-200 text-green-700 hover:bg-green-50"
                data-testid="share-whatsapp-btn"
              >
                <Share2 className="w-4 h-4 mr-2" /> Compartir
              </Button>

              {isOrganizer && (
                <Button
                  variant="outline"
                  onClick={handleDuplicate}
                  disabled={!!actionLoading}
                  className="rounded-full"
                  data-testid="duplicate-match-btn"
                >
                  <Copy className="w-4 h-4 mr-2" /> Duplicar
                </Button>
              )}
            </div>
          </div>

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
                  <p className="font-semibold text-slate-900">{titulars.length}/{match.max_players}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {match.maps_link && (
            <a
              href={match.maps_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm text-turf hover:underline"
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
                  {match.status === 'cancelado' ? 'Este partido fue cancelado' : 'Resolvé lo importante de este partido desde acá'}
                </p>
              </div>

              {'to' in primaryAction ? (
                <Link to={primaryAction.to}>
                  <Button className={`rounded-full px-6 font-bold uppercase ${primaryAction.className}`} data-testid={primaryAction.testId}>
                    <primaryAction.icon className="w-4 h-4 mr-2" />
                    {primaryAction.label}
                  </Button>
                </Link>
              ) : (
                <Button
                  onClick={primaryAction.onClick}
                  disabled={!!actionLoading || match.status === 'cancelado'}
                  variant={primaryAction.variant || 'default'}
                  className={`rounded-full px-6 font-bold uppercase ${primaryAction.className}`}
                  data-testid={primaryAction.testId}
                >
                  <primaryAction.icon className="w-4 h-4 mr-2" />
                  {primaryAction.label}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.95fr] gap-6 items-start">
          <div className="space-y-6">
            {canEditRegistrations && <ManagementNotice />}

            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-turf" />
                  Titulares ({titulars.length}/{match.max_players})
                </CardTitle>
                <p className="text-sm text-slate-500">Tocá la foto para verla más grande.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {titulars.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">Sin titulares aún</p>
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

          <div className="space-y-6">
            <Card className="border-slate-100 shadow-sm sticky top-20">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-lg uppercase">Acciones del organizador</CardTitle>
                <p className="text-sm text-slate-500">Bloque secundario para gestión y limpieza del partido.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {isOrganizer && match.status === 'abierto' && (
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={!!actionLoading}
                    className="w-full rounded-xl"
                    data-testid="secondary-close-registrations"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {actionLoading === 'close' ? 'Cerrando...' : 'Cerrar inscripciones'}
                  </Button>
                )}

                {isOrganizer && ['cerrado', 'equipos_generados'].includes(match.status) && (
                  <Button
                    onClick={handleGenerateTeams}
                    disabled={!!actionLoading}
                    className="w-full rounded-xl bg-orange hover:bg-orange-light text-white"
                    data-testid="secondary-generate-teams"
                  >
                    <Shuffle className="w-4 h-4 mr-2" />
                    {actionLoading === 'generate' ? 'Generando...' : (match.status === 'equipos_generados' ? 'Recalcular equipos' : 'Generar equipos')}
                  </Button>
                )}

                {['equipos_generados', 'equipos_confirmados'].includes(match.status) && (
                  <Link to={`/partidos/${id}/equipos`}>
                    <Button variant="outline" className="w-full rounded-xl" data-testid="view-teams-btn">
                      Ver equipos
                    </Button>
                  </Link>
                )}

                {isOrganizer && match.status === 'equipos_confirmados' && (
                  <Button
                    onClick={handleFinalize}
                    disabled={!!actionLoading}
                    className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white"
                    data-testid="secondary-finalize-match"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {actionLoading === 'finalize' ? 'Finalizando...' : 'Finalizar partido'}
                  </Button>
                )}

                {isOrganizer && match.status !== 'cancelado' && !['finalizado', 'completado'].includes(match.status) && (
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={!!actionLoading}
                    className="w-full rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50"
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
                    className="w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                    data-testid="delete-match-btn"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {actionLoading === 'delete' ? 'Borrando...' : 'Borrar definitivamente'}
                  </Button>
                )}

                {match.status === 'cancelado' && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    Este partido está cancelado. Ya no admite nuevas acciones deportivas, pero sigue visible en el historial.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
