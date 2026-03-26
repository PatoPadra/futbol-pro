import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Shield, Users } from 'lucide-react';
import { toast } from 'sonner';

import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import PageLoader from '../components/common/PageLoader';
import MatchMetaGrid from '../components/matches/MatchMetaGrid';
import MatchPrimaryActions from '../components/matches/MatchPrimaryActions';
import RegistrationListCard from '../components/matches/RegistrationListCard';
import { MATCH_STATUS_LABELS, MATCH_STATUS_STYLES, MODALITY_LABELS } from '../constants/matches';
import { canManageMatch, isAdmin } from '../utils/permissions';

export default function MatchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const loadData = async () => {
    try {
      const [matchRes, regsRes] = await Promise.all([
        api.get(`/matches/${id}`),
        api.get(`/matches/${id}/registrations`),
      ]);
      setMatch(matchRes.data);
      setRegistrations(regsRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cargar partido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const isOrganizer = canManageMatch(match, user);
  const canHardDelete = isAdmin(user);
  const isRegistered = !!match?.my_registration;

  const titulars = useMemo(
    () => registrations.filter((registration) => registration.status === 'titular'),
    [registrations]
  );
  const suplentes = useMemo(
    () => registrations.filter((registration) => registration.status === 'suplente'),
    [registrations]
  );

  const handleRegister = async () => {
    setActionLoading('register');
    try {
      await api.post(`/matches/${id}/register`);
      toast.success('Te anotaste');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setActionLoading('');
    }
  };

  const handleUnregister = async () => {
    setActionLoading('unregister');
    try {
      await api.delete(`/matches/${id}/register`);
      toast.success('Te diste de baja');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setActionLoading('');
    }
  };

  const handleClose = async () => {
    setActionLoading('close');
    try {
      await api.post(`/matches/${id}/close`);
      toast.success('Inscripciones cerradas');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setActionLoading('');
    }
  };

  const handleGenerateTeams = async () => {
    setActionLoading('generate');
    try {
      await api.post(`/matches/${id}/generate-teams`);
      toast.success('Equipos generados');
      navigate(`/partidos/${id}/equipos`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al generar equipos');
    } finally {
      setActionLoading('');
    }
  };

  const handleFinalize = async () => {
    setActionLoading('finalize');
    try {
      await api.post(`/matches/${id}/finalize`);
      toast.success('Partido finalizado');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setActionLoading('');
    }
  };

  const handleDuplicate = async () => {
    setActionLoading('duplicate');
    try {
      const response = await api.post(`/matches/${id}/duplicate`);
      toast.success(response.data.message);
      navigate(`/partidos/${response.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al duplicar');
    } finally {
      setActionLoading('');
    }
  };

  const handleShareWhatsApp = () => {
    const url = window.location.href;
    const text = `${match.title}%0A${match.date} a las ${match.time}%0A${match.location}%0ATitulares: ${titulars.length}/${match.max_players}%0A%0AAnotate aca: ${url}`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleCancelMatch = async () => {
    setActionLoading('cancel');
    try {
      await api.post(`/matches/${id}/cancel`);
      toast.success('Partido cancelado');
      setConfirmCancelOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cancelar');
    } finally {
      setActionLoading('');
    }
  };

  const handleDeleteMatch = async () => {
    setActionLoading('delete');
    try {
      await api.delete(`/matches/${id}`);
      toast.success('Partido borrado definitivamente');
      setConfirmDeleteOpen(false);
      navigate('/partidos');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al borrar');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return <PageLoader label="Cargando partido..." />;
  }

  if (!match) {
    return <div className="page-container text-center text-slate-500">Partido no encontrado</div>;
  }

  const nextActionHint = match.status === 'abierto'
    ? 'Abrí la convocatoria, llená titulares y cerrá inscripciones cuando tengas base suficiente.'
    : match.status === 'cerrado'
      ? 'Ya cerraste la lista. El siguiente paso es generar equipos.'
      : match.status === 'equipos_generados'
        ? 'Revisá el balance y confirmá o recalculá los equipos.'
        : match.status === 'equipos_confirmados'
          ? 'Con los equipos listos, solo falta jugar y finalizar el partido.'
          : match.status === 'finalizado'
            ? 'Ahora los participantes pueden evaluar y proponer estadísticas.'
            : match.status === 'cancelado'
              ? 'Este partido quedó cancelado y ya no aparece como pendiente.'
              : 'Este partido ya quedó cerrado por completo.';

  return (
    <div className="page-container max-w-6xl mx-auto" data-testid="match-detail-page">
      <div className="animate-slide-up space-y-6">
        <section className="rounded-[28px] border border-slate-100 bg-white p-6 md:p-7 shadow-sm shadow-slate-100/80 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-turf via-orange to-slate-900" />

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge className={`text-xs font-semibold border ${MATCH_STATUS_STYLES[match.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {MATCH_STATUS_LABELS[match.status] || match.status}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {MODALITY_LABELS[match.modality] || `Futbol ${match.modality}`}
                </Badge>
                {canHardDelete && (
                  <Badge className="bg-slate-900 text-white">
                    <Shield className="w-3 h-3 mr-1" /> Admin
                  </Badge>
                )}
              </div>

              <h1 className="font-heading text-3xl md:text-5xl font-bold uppercase tracking-tight text-slate-900">
                {match.title}
              </h1>
              <p className="text-slate-500 mt-2">
                Organizado por <span className="font-medium text-slate-700">{match.organizer_name}</span>
                {match.group_name ? ` · Grupo ${match.group_name}` : ''}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 min-w-[220px]">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Siguiente paso</p>
              <p className="text-sm font-medium text-slate-700 leading-relaxed">{nextActionHint}</p>
            </div>
          </div>

          {match.status === 'cancelado' && (
            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700">Partido cancelado</p>
                <p className="text-sm text-red-700/80">
                  La convocatoria quedó cerrada. Si fue una corrección administrativa, un admin todavía puede borrar el registro definitivamente.
                </p>
              </div>
            </div>
          )}
        </section>

        <MatchMetaGrid match={match} titularsCount={titulars.length} />

        <MatchPrimaryActions
          match={match}
          isOrganizer={isOrganizer}
          isRegistered={isRegistered}
          actionLoading={actionLoading}
          onRegister={handleRegister}
          onUnregister={handleUnregister}
          onClose={handleClose}
          onGenerateTeams={handleGenerateTeams}
          onFinalize={handleFinalize}
          onDuplicate={handleDuplicate}
          onShareWhatsApp={handleShareWhatsApp}
          onCancel={() => setConfirmCancelOpen(true)}
          onDelete={canHardDelete ? () => setConfirmDeleteOpen(true) : null}
        />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <RegistrationListCard
              title={`Titulares (${titulars.length}/${match.max_players})`}
              dotClassName="bg-turf"
              emptyLabel="Sin titulares aún"
              rows={titulars}
              testIdPrefix="titular"
            />
            <RegistrationListCard
              title={`Suplentes (${suplentes.length})`}
              dotClassName="bg-orange"
              emptyLabel="Sin suplentes"
              rows={suplentes}
              testIdPrefix="suplente"
            />
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100/70">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Lectura rápida</p>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span>Estado</span>
                  <span className="font-semibold text-slate-900">{MATCH_STATUS_LABELS[match.status] || match.status}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Convocados</span>
                  <span className="font-semibold text-slate-900">{registrations.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Titulares completos</span>
                  <span className="font-semibold text-slate-900">{titulars.length >= match.max_players ? 'Sí' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100/70">
              <p className="font-heading text-lg uppercase text-slate-900">Accesos útiles</p>
              <div className="mt-4 flex flex-col gap-2">
                {['equipos_generados', 'equipos_confirmados'].includes(match.status) && (
                  <Link to={`/partidos/${id}/equipos`}>
                    <Button variant="outline" className="w-full rounded-full">Abrir equipos</Button>
                  </Link>
                )}
                {match.status === 'finalizado' && isRegistered && (
                  <Link to={`/partidos/${id}/post-partido`}>
                    <Button className="w-full rounded-full bg-orange hover:bg-orange-light text-white">Cargar evaluación</Button>
                  </Link>
                )}
                <Link to="/partidos">
                  <Button variant="outline" className="w-full rounded-full">Volver a partidos</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar partido</AlertDialogTitle>
            <AlertDialogDescription>
              El partido quedará marcado como cancelado, dejará de contarse como pendiente y conservará su historial. Esta acción es reversible solo con intervención manual en base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelMatch} className="bg-red-600 hover:bg-red-700">
              {actionLoading === 'cancel' ? 'Cancelando...' : 'Sí, cancelar partido'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrar partido definitivamente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción elimina el partido, inscripciones, ratings, estadísticas y generaciones de equipos. Es una acción de admin y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMatch} className="bg-red-600 hover:bg-red-700">
              {actionLoading === 'delete' ? 'Borrando...' : 'Sí, borrar definitivo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
