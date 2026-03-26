import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '../contexts/AuthContext';
import api, { API_URL } from '../lib/api';
import { getMatchStatusLabel, getMatchStatusStyle, getModalityLabel } from '../constants/matches';
import { canManageMatch } from '../utils/permissions';
import MatchMetaGrid from '../components/matches/MatchMetaGrid';
import MatchPrimaryActions from '../components/matches/MatchPrimaryActions';
import RegistrationListCard from '../components/matches/RegistrationListCard';
import PageLoader from '../components/common/PageLoader';
import { Badge } from '../components/ui/badge';

export default function MatchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData() {
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
  }

  const isOrganizer = canManageMatch(match, user);
  const isRegistered = Boolean(match?.my_registration);
  const titulars = useMemo(() => registrations.filter((registration) => registration.status === 'titular'), [registrations]);
  const suplentes = useMemo(() => registrations.filter((registration) => registration.status === 'suplente'), [registrations]);

  const handleRegister = async () => {
    setActionLoading('register');
    try {
      await api.post(`/matches/${id}/register`);
      toast.success('Te anotaste!');
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
      toast.success('Equipos generados!');
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
      const res = await api.post(`/matches/${id}/duplicate`);
      toast.success(res.data.message);
      navigate(`/partidos/${res.data.id}`);
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

  if (loading) return <PageLoader />;

  if (!match) {
    return <div className="page-container text-center text-slate-500">Partido no encontrado</div>;
  }

  return (
    <div className="page-container max-w-3xl mx-auto" data-testid="match-detail-page">
      <div className="animate-slide-up">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className={`${getMatchStatusStyle(match.status)} text-xs font-semibold`}>
                {getMatchStatusLabel(match.status)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {getModalityLabel(match.modality)}
              </Badge>
            </div>

            <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">{match.title}</h1>

            <p className="text-sm text-slate-500 mt-1">Organizado por {match.organizer_name}</p>

            {match.group_name && (
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mt-2">
                Grupo: {match.group_name}
              </p>
            )}
          </div>
        </div>

        <MatchMetaGrid match={match} titularCount={titulars.length} />

        <MatchPrimaryActions
          match={match}
          matchId={id}
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
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RegistrationListCard
            title="Titulares"
            registrations={titulars}
            maxPlayers={match.max_players}
            photoBaseUrl={API_URL}
          />

          <RegistrationListCard
            title="Suplentes"
            registrations={suplentes}
            tone="orange"
            photoBaseUrl={API_URL}
          />
        </div>
      </div>
    </div>
  );
}
