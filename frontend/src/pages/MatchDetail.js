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
  Dumbbell,
  ExternalLink,
  Gauge,
  Info,
  LayoutGrid,
  MapPin,
  Play,
  RefreshCw,
  Settings2,
  Share2,
  Swords,
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
import ConfirmDialog from '@/components/common/ConfirmDialog';
import MatchResultPanel from '@/components/matches/MatchResultPanel';
import Panel from '@/components/matches/Panel';
import MetaChip from '@/components/matches/MetaChip';
import useMatchCatalogs from '@/hooks/use-match-catalogs';
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
  const [attendanceSaving, setAttendanceSaving] = useState('');
  const [notas, setNotas] = useState({});
  // La acción irreversible que está esperando confirmación. Una sola pieza de
  // estado para las tres (cancelar, borrar, quitar a un anotado).
  const [pendiente, setPendiente] = useState(null);
  const { attendance: attendanceOptions } = useMatchCatalogs();

  const loadData = async ({ keepLoader = false } = {}) => {
    if (!keepLoader) setLoading(true);
    setLoadError(null);
    try {
      const [matchRes, regsRes, notasRes] = await Promise.all([
        api.get(`/matches/${id}`),
        api.get(`/matches/${id}/registrations`),
        // Sólo el organizador tiene notas; para el resto el endpoint responde
        // 403 y se sigue de largo con un objeto vacío.
        api.get(`/matches/${id}/notes`).catch(() => ({ data: {} })),
      ]);
      setMatch(matchRes.data);
      setRegistrations(regsRes.data || []);
      setNotas(notasRes.data || {});
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
  // Con la inscripción abierta no hay nada que marcar: el que no va se da de
  // baja solo. Después del partido sí, y corregir una marca vieja reajusta el
  // contador de partidos jugados del jugador.
  const canMarkAttendance = isOrganizer && !['abierto', 'cancelado'].includes(match?.status);

  // Todo lo que la pantalla ofrece sale de las capacidades del modo, que vienen
  // resueltas del backend. Acá no hay ni un `if (modo === 'pro')`: si mañana un
  // modo cambia de comportamiento, cambia en constants.py y esta pantalla se
  // entera sola.
  const capacidades = match?.capabilities || {};
  const armaEquipos = capacidades.team_source === 'algoritmo';
  // El modo con DT no reparte: arma una alineación con banco. Es otra acción y
  // se llama distinto, aunque por dentro use el mismo endpoint.
  const armaAlineacion = capacidades.team_source === 'manual';
  const tieneEquipos = armaEquipos || armaAlineacion;
  const evaluaPorPartido = Boolean(capacidades.rating_por_partido);
  const statsSource = capacidades.stats_source || 'ninguno';
  // Quién tiene algo que hacer en el post partido depende del modo: si se
  // evalúa, todos los que jugaron; si las estadísticas son por consenso,
  // también; si las carga el organizador, sólo él.
  const hayPostPartido =
    (evaluaPorPartido && isRegistered)
    || (statsSource === 'consenso' && isRegistered)
    || (statsSource === 'organizador' && isOrganizer);
  // Sin equipos que armar, el partido va derecho de cerrado a finalizado. Sin
  // esto un partido de Diversión no llegaría nunca a poder cargar su resultado.
  const finalizaDesdeCerrado = !tieneEquipos && match?.status === 'cerrado';
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
  // Cerrar dejó de ser una puerta de una sola dirección, así que ya no necesita
  // un diálogo: la salida está a un toque de distancia.
  const handleReopen = () => runAction('reopen', () => api.post(`/matches/${id}/reopen`), 'Inscripción reabierta');
  const handleGenerateTeams = () => runAction('generate', () => api.post(`/matches/${id}/generate-teams`), 'Equipos generados', { reload: false, onSuccess: () => navigate(`/partidos/${id}/equipos`) });
  const handleFinalize = () => runAction('finalize', () => api.post(`/matches/${id}/finalize`), 'Partido finalizado');
  const handleDuplicate = () => runAction('duplicate', () => api.post(`/matches/${id}/duplicate`), null, { reload: false, onSuccess: (response) => {
    toast.success(response.data.message);
    navigate(`/partidos/${response.data.id}`);
  }});

  // Las acciones que no se deshacen pasan por ConfirmDialog. Antes eran
  // `window.confirm` nativos: tipografía del sistema, botón azul del navegador,
  // y la consecuencia perdida en un párrafo que nadie lee.
  const handleCancel = () => setPendiente({
    clave: 'cancel',
    titulo: '¿Cancelar este partido?',
    descripcion: 'Se avisa que no se juega, pero el partido queda en el historial.',
    consecuencias: [
      'Nadie se puede anotar ni dar de baja.',
      'Los jugadores anotados y sus datos no se borran.',
      'No se puede volver a abrir: hay que crear un partido nuevo.',
    ],
    textoConfirmar: 'Cancelar partido',
    onConfirmar: () => runAction('cancel', () => api.post(`/matches/${id}/cancel`), 'Partido cancelado'),
  });

  const handleDelete = () => setPendiente({
    clave: 'delete',
    titulo: '¿Borrar este partido para siempre?',
    descripcion: 'Esta acción no se puede deshacer.',
    consecuencias: [
      'Se borran las inscripciones, los equipos generados y las estadísticas.',
      'Se borran las evaluaciones y el puntaje que este partido le dio a cada uno.',
      'A los que ya lo habían jugado se les descuenta del total de partidos.',
    ],
    textoConfirmar: 'Borrar partido',
    onConfirmar: () => runAction('delete', () => api.delete(`/matches/${id}`), 'Partido borrado', { reload: false, onSuccess: () => navigate('/partidos') }),
  });

  const handleAttendanceChange = async (registration, marca) => {
    const anterior = registration.attendance || null;

    // Optimista: la marca se ve al toque. Tomar asistencia son diez o veinte
    // toques seguidos y esperar el ida y vuelta en cada uno convierte medio
    // minuto de tarea en tres.
    setAttendanceSaving(registration.player_id);
    setRegistrations((prev) =>
      prev.map((r) => (r.player_id === registration.player_id ? { ...r, attendance: marca } : r))
    );

    try {
      await api.put(`/matches/${id}/attendance`, {
        entries: [{ player_id: registration.player_id, attendance: marca }],
      });
    } catch (err) {
      setRegistrations((prev) =>
        prev.map((r) => (r.player_id === registration.player_id ? { ...r, attendance: anterior } : r))
      );
      toast.error(err.response?.data?.detail || 'No se pudo guardar la asistencia');
    } finally {
      setAttendanceSaving('');
    }
  };

  const handleNoteSave = async (registration, texto) => {
    const limpio = (texto || '').trim();
    try {
      await api.put(`/matches/${id}/notes/${registration.player_id}`, { text: limpio });
      setNotas((prev) => {
        const siguiente = { ...prev };
        if (limpio) siguiente[registration.player_id] = { text: limpio };
        else delete siguiente[registration.player_id];
        return siguiente;
      });
      toast.success(limpio ? 'Nota guardada' : 'Nota borrada');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo guardar la nota');
      // Se propaga para que el campo no se cierre como si hubiera guardado.
      throw err;
    }
  };

  // Quitar a un anotado SÍ se deshace —el backend lo marca de baja, no lo
  // borra, y se puede volver a anotar— así que va en tono normal y no en rojo.
  // La regla que el usuario aprende: rojo con lista es lo que no vuelve.
  const handleRemoveRegistration = (registration) => setPendiente({
    clave: `remove-${registration.id}`,
    tono: 'normal',
    titulo: `¿Quitar a ${registration.player_name}?`,
    descripcion: 'Se puede volver a anotar mientras la inscripción esté abierta.',
    consecuencias: registration.status === 'titular'
      ? ['Si hay suplentes, el primero pasa a titular automáticamente.']
      : [],
    textoConfirmar: 'Quitar del partido',
    onConfirmar: () => runAction(
      `remove-${registration.id}`,
      () => api.delete(`/matches/${id}/registrations/${registration.id}`),
      null,
    ),
  });

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
            <Button data-testid="back-to-matches-btn" shape="pill" className="h-11 px-8 bg-turf-btn hover:bg-turf-btn-dark text-white shadow-lg shadow-turf/20">
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
            className="h-11 px-8 bg-turf-btn hover:bg-turf-btn-dark text-white shadow-lg shadow-turf/20"
          >
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const spotsLeft = match.max_players - titulars.length;
  const isFull = spotsLeft <= 0;
  // El horario del partido, como dato. NO bloquea: el que cierra la inscripcion
  // es el organizador con su boton, y eso es lo unico que el servidor respeta.
  //
  // Antes esta variable deshabilitaba el boton de anotarse, y el dato que la
  // alimentaba era mediodia UTC clavado —las 9 de la mañana en Argentina— que
  // el backend nunca leyo. O sea que la pantalla decia "cerrada" mientras el
  // servidor seguia aceptando anotados: dos verdades distintas sobre el mismo
  // hecho, y la que le tocaba al usuario era la falsa.
  const yaEmpezo = Boolean(match.deadline) && new Date() > new Date(match.deadline);
  const deadlineLabel = formatDeadline(match.deadline);
  const fillPct = match.max_players
    ? Math.min(100, Math.round((titulars.length / match.max_players) * 100))
    : 0;

  const primaryAction = (() => {
    if (match.status === 'abierto' && !isRegistered) {
      return {
        label: actionLoading === 'register' ? 'Anotando...' : 'Anotarme',
        icon: UserPlus,
        onClick: handleRegister,
        className: 'bg-turf-btn hover:bg-turf-btn-dark text-white shadow-lg shadow-turf/20',
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
        description: yaEmpezo
          ? 'La hora del partido ya pasó: cerrá la inscripción para armar los equipos. Si te apurás, se puede reabrir.'
          : `El partido es ${deadlineLabel ? `el ${deadlineLabel} hs` : 'pronto'}. Cerrala cuando esté la lista; si cerrás de más, se puede reabrir.`,
      };
    }
    if (isOrganizer && tieneEquipos && ['cerrado', 'equipos_generados'].includes(match.status)) {
      const yaEstan = match.status === 'equipos_generados';
      return {
        label: actionLoading === 'generate'
          ? (armaAlineacion ? 'Armando...' : 'Generando...')
          : (armaAlineacion
            ? (yaEstan ? 'Rearmar alineación' : 'Armar alineación')
            : (yaEstan ? 'Recalcular equipos' : 'Generar equipos')),
        icon: Shuffle,
        onClick: handleGenerateTeams,
        className: 'bg-orange hover:bg-orange-light text-white shadow-lg shadow-orange/20',
        testId: 'generate-teams-btn',
        description: armaAlineacion
          ? 'Te proponemos un once con los puestos de cada uno. Después lo acomodás vos.'
          : 'Armamos equipos balanceados automáticamente con los jugadores anotados.',
      };
    }
    if (isOrganizer && finalizaDesdeCerrado) {
      return {
        label: actionLoading === 'finalize' ? 'Finalizando...' : 'Finalizar partido',
        icon: Play,
        onClick: handleFinalize,
        className: 'bg-secondary text-secondary-foreground',
        testId: 'finalize-match-btn',
        description: 'En este modo no se arman equipos: marcá el partido como jugado y cargá el resultado.',
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
    if (match.status === 'finalizado' && hayPostPartido) {
      // La etiqueta dice lo que este modo pide de verdad. "Evaluar y
      // estadísticas" en un partido que sólo lleva estadísticas manda al que
      // entra a buscar una pantalla de evaluación que no existe.
      const soloStats = !evaluaPorPartido;
      const soloEvaluacion = statsSource === 'ninguno';
      return {
        label: soloStats ? 'Cargar estadísticas' : (soloEvaluacion ? 'Evaluar compañeros' : 'Evaluar y estadísticas'),
        icon: Play,
        to: `/partidos/${id}/post-partido`,
        className: 'bg-orange hover:bg-orange-light text-white shadow-lg shadow-orange/20',
        testId: 'post-match-btn',
        description: soloStats
          ? 'Cargá las estadísticas de la fecha.'
          : (soloEvaluacion
            ? 'Calificá a tus compañeros de partido.'
            : 'Cargá las estadísticas y calificá a tus compañeros de partido.'),
      };
    }
    return null;
  })();

  const ManagementNotice = () => (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        Como organizador podés quitar jugadores del partido. Si quitás un titular, sube automáticamente el primer suplente.
        {canMarkAttendance && ' Y podés marcar quién vino: sin marcar, el partido cuenta para todos los titulares.'}
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
              {match.mode_label && <MetaChip icono={Gauge}>{match.mode_label}</MetaChip>}
              {match.opponent_name && (
                <MetaChip icono={Swords} tono="orange">vs {match.opponent_name}</MetaChip>
              )}
              {match.tournament_name && (
                <MetaChip icono={Trophy}>{match.tournament_name}</MetaChip>
              )}
              {/* El tipo se muestra sólo cuando es práctica. Un chip "Oficial"
                  en todos los partidos no enseña nada: lo que informa es la
                  excepción. */}
              {match.match_type === 'practica' && (
                <MetaChip icono={Dumbbell} tono="orange">Práctica</MetaChip>
              )}
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
              yaEmpezo
                ? 'border-amber-200 bg-amber-50 font-semibold text-amber-900'
                : 'border-slate-200/80 bg-white text-slate-600 shadow-sm'
            }`}
            data-testid="registration-deadline"
          >
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {yaEmpezo
                ? `El partido era el ${deadlineLabel} hs, y la inscripción sigue abierta`
                : `Te podés anotar hasta que el organizador cierre la lista. El partido es el ${deadlineLabel} hs`}
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

        {/* Va antes que todo lo demás: cuando alguien abre un partido de la
            semana pasada, lo primero que quiere saber es cómo salió. */}
        <MatchResultPanel
          match={match}
          canManage={isOrganizer}
          api={api}
          onSaved={() => loadData({ keepLoader: true })}
          onError={(err) => toast.error(err.response?.data?.detail || 'No se pudo guardar el resultado')}
        />

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
                <DatoTile icono={Gauge} etiqueta="Modo">
                  <span className="block truncate">{match.mode_label || 'Con puntajes'}</span>
                  <span className="block text-xs font-normal text-slate-600">
                    {match.match_type === 'practica' ? 'Práctica' : 'Partido oficial'}
                    {match.tracked_stats?.length
                      ? ` · ${match.tracked_stats.length} ${match.tracked_stats.length === 1 ? 'estadística' : 'estadísticas'}`
                      : ''}
                  </span>
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
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">{armaAlineacion ? 'Alineación' : 'Equipos'}</p>
                      <p className="mt-0.5 font-semibold text-slate-900">
                        {armaAlineacion
                          ? (match.status === 'equipos_confirmados' ? 'La alineación está confirmada' : 'La alineación ya está armada')
                          : (match.status === 'equipos_confirmados' ? 'Los equipos ya están confirmados' : 'Los equipos ya fueron generados')}
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
                      {armaAlineacion ? 'Ver alineación' : 'Ver equipos'}
                    </Button>
                  </Link>
                </div>
              </section>
            )}

            {canEditRegistrations && <ManagementNotice />}

            <Panel
              icono={ClipboardList}
              titulo={armaAlineacion ? 'El plantel' : 'Titulares'}
              contador={`${titulars.length}/${match.max_players}`}
              bajada={
                titulars.length > 0
                  ? (armaAlineacion
                    ? 'Los que están para jugar. Quién arranca se decide en la alineación.'
                    : 'Tocá la foto para verla más grande.')
                  : undefined
              }
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
                    attendanceOptions={canMarkAttendance ? attendanceOptions : null}
                    onAttendanceChange={canMarkAttendance ? handleAttendanceChange : null}
                    attendanceSaving={attendanceSaving === registration.player_id}
                    nota={notas[registration.player_id]?.text}
                    onNoteSave={canMarkAttendance ? handleNoteSave : null}
                  />
                ))
              )}
            </Panel>

            <Panel
              icono={Users}
              titulo={armaAlineacion ? 'En espera' : 'Suplentes'}
              contador={suplentes.length}
              bajada={
                suplentes.length > 0
                  ? (armaAlineacion
                    ? 'Se anotaron después del cupo: todavía no están en el plantel.'
                    : 'Entran por orden si se cae un titular.')
                  : undefined
              }
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
                    attendanceOptions={canMarkAttendance ? attendanceOptions : null}
                    onAttendanceChange={canMarkAttendance ? handleAttendanceChange : null}
                    attendanceSaving={attendanceSaving === registration.player_id}
                    nota={notas[registration.player_id]?.text}
                    onNoteSave={canMarkAttendance ? handleNoteSave : null}
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

                {tieneEquipos && ['cerrado', 'equipos_generados'].includes(match.status) && (
                  <Button
                    onClick={handleGenerateTeams}
                    disabled={!!actionLoading}
                    shape="pill"
                    className="w-full h-11 bg-orange hover:bg-orange-light text-white shadow-lg shadow-orange/20"
                    data-testid="secondary-generate-teams"
                  >
                    <Shuffle className="w-4 h-4 mr-2" aria-hidden="true" />
                    {actionLoading === 'generate'
                      ? 'Trabajando...'
                      : armaAlineacion
                        ? (match.status === 'equipos_generados' ? 'Rearmar alineación' : 'Armar alineación')
                        : (match.status === 'equipos_generados' ? 'Recalcular equipos' : 'Generar equipos')}
                  </Button>
                )}

                {(match.status === 'equipos_confirmados' || finalizaDesdeCerrado) && (
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

                {/* Reabrir. Cerrar la inscripción era una puerta de una sola
                    dirección: cerrar de más un jueves obligaba a cancelar el
                    partido y rehacerlo, perdiendo a todos los anotados.
                    Sólo desde "cerrado": apenas hay equipos armados, quitar
                    gente tiene su propio camino. */}
                {match.status === 'cerrado' && (
                  <Button
                    variant="outline"
                    onClick={handleReopen}
                    disabled={!!actionLoading}
                    shape="pill"
                    className="w-full h-11 border-2 border-slate-200 hover:border-slate-400"
                    data-testid="reopen-registrations"
                  >
                    <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
                    {actionLoading === 'reopen' ? 'Reabriendo...' : 'Reabrir inscripción'}
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

      <ConfirmDialog
        abierto={!!pendiente}
        onCambio={() => setPendiente(null)}
        titulo={pendiente?.titulo}
        descripcion={pendiente?.descripcion}
        consecuencias={pendiente?.consecuencias || []}
        textoConfirmar={pendiente?.textoConfirmar}
        tono={pendiente?.tono || 'riesgo'}
        cargando={!!pendiente && actionLoading === pendiente.clave}
        onConfirmar={() => {
          const accion = pendiente?.onConfirmar;
          setPendiente(null);
          accion?.();
        }}
        testId="match-confirm"
      />
    </div>
  );
}
