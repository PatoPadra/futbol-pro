import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Calendar, Clock, MapPin, Users, ExternalLink, UserPlus, UserMinus, Shuffle, Play, Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const MOD_LABELS = { 5: 'Futbol 5', 6: 'Futbol 6', 7: 'Futbol 7', 8: 'Futbol 8', 9: 'Futbol 9', 10: 'Futbol 10', 11: 'Futbol 11' };
const STATUS_LABELS = {
  abierto: 'Abierto',
  cerrado: 'Cerrado',
  equipos_generados: 'Equipos Generados',
  equipos_confirmados: 'Equipos Confirmados',
  finalizado: 'Finalizado',
  completado: 'Completado'
};

export default function MatchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

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

  const profileId = user?.profile_id || user?.profile?.id;
  const isOrganizer = match && (match.my_group_role === 'organizador' || user?.role === 'admin');
  const isRegistered = !!match?.my_registration;
  const titulars = registrations.filter(r => r.status === 'titular');
  const suplentes = registrations.filter(r => r.status === 'suplente');

  const handleRegister = async () => {
    setActionLoading('register');
    try {
      await api.post(`/matches/${id}/register`);
      toast.success('Te anotaste!');
      loadData();
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
      loadData();
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
      loadData();
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
      loadData();
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!match) {
    return <div className="page-container text-center text-slate-500">Partido no encontrado</div>;
  }

  return (
    <div className="page-container max-w-3xl mx-auto" data-testid="match-detail-page">
      <div className="animate-slide-up">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-turf/10 text-turf border-turf/20 text-xs font-semibold">
                {STATUS_LABELS[match.status] || match.status}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {MOD_LABELS[match.modality] || `Futbol ${match.modality}`}
              </Badge>
            </div>

            <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">
              {match.title}
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              Organizado por {match.organizer_name}
            </p>

            {match.group_name && (
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mt-2">
                Grupo: {match.group_name}
              </p>
            )}
          </div>
        </div>

        <Card className="border-slate-100 mb-6">
          <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>{match.date}</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>{match.time}</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>{match.location}</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Users className="w-4 h-4 text-slate-400" />
              <span>{titulars.length}/{match.max_players} titulares</span>
            </div>

            {match.maps_link && (
              <a
                href={match.maps_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-turf hover:underline col-span-full"
                data-testid="maps-link"
              >
                <ExternalLink className="w-4 h-4" />
                Ver ubicacion en mapa
              </a>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3 mb-6">
          {match.status === 'abierto' && !isRegistered && (
            <Button
              data-testid="register-for-match"
              onClick={handleRegister}
              disabled={!!actionLoading}
              className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase tracking-wider"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {actionLoading === 'register' ? 'Anotando...' : 'Anotarme'}
            </Button>
          )}

          {match.status === 'abierto' && isRegistered && (
            <Button
              data-testid="unregister-from-match"
              variant="outline"
              onClick={handleUnregister}
              disabled={!!actionLoading}
              className="rounded-full px-6 border-red-200 text-red-600 hover:bg-red-50"
            >
              <UserMinus className="w-4 h-4 mr-2" />
              Darme de baja
            </Button>
          )}

          {isOrganizer && match.status === 'abierto' && (
            <Button
              data-testid="close-registrations"
              variant="outline"
              onClick={handleClose}
              disabled={!!actionLoading}
              className="rounded-full px-6"
            >
              Cerrar Inscripciones
            </Button>
          )}

          {isOrganizer && ['cerrado', 'equipos_generados'].includes(match.status) && (
            <Button
              data-testid="generate-teams-btn"
              onClick={handleGenerateTeams}
              disabled={!!actionLoading}
              className="bg-orange hover:bg-orange-light text-white rounded-full px-6 font-bold uppercase tracking-wider"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              {match.status === 'equipos_generados' ? 'Recalcular' : 'Generar'} Equipos
            </Button>
          )}

          {['equipos_generados', 'equipos_confirmados'].includes(match.status) && (
            <Link to={`/partidos/${id}/equipos`}>
              <Button
                data-testid="view-teams-btn"
                variant="outline"
                className="rounded-full px-6"
              >
                Ver Equipos
              </Button>
            </Link>
          )}

          {isOrganizer && match.status === 'equipos_confirmados' && (
            <Button
              data-testid="finalize-match-btn"
              onClick={handleFinalize}
              disabled={!!actionLoading}
              className="bg-slate-800 text-white rounded-full px-6 font-bold uppercase"
            >
              <Play className="w-4 h-4 mr-2" />
              Finalizar Partido
            </Button>
          )}

          {match.status === 'finalizado' && isRegistered && (
            <Link to={`/partidos/${id}/post-partido`}>
              <Button
                data-testid="post-match-btn"
                className="bg-orange hover:bg-orange-light text-white rounded-full px-6 font-bold uppercase"
              >
                Evaluar y Estadisticas
              </Button>
            </Link>
          )}

          {isOrganizer && (
            <Button
              data-testid="duplicate-match-btn"
              variant="outline"
              onClick={handleDuplicate}
              disabled={!!actionLoading}
              className="rounded-full px-5"
            >
              <Copy className="w-4 h-4 mr-2" />
              Duplicar (+7 dias)
            </Button>
          )}

          <Button
            data-testid="share-whatsapp-btn"
            variant="outline"
            onClick={handleShareWhatsApp}
            className="rounded-full px-5 border-green-200 text-green-700 hover:bg-green-50"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Compartir
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-turf" />
                Titulares ({titulars.length}/{match.max_players})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {titulars.length === 0 && (
                <p className="text-sm text-slate-400 py-4 text-center">Sin titulares aun</p>
              )}

              {titulars.map((r, i) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"
                  data-testid={`titular-${r.player_id}`}
                >
                  <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>

                  <Avatar className="w-9 h-9">
                    <AvatarImage src={r.player_photo ? `${API_URL}${r.player_photo}` : undefined} />
                    <AvatarFallback className="bg-turf/10 text-turf text-xs font-bold">
                      {r.player_name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/jugadores/${r.player_id}`}
                      className="text-sm font-medium text-slate-900 hover:text-turf truncate block"
                    >
                      {r.player_name}
                    </Link>
                    {r.primary_position && (
                      <span className="text-xs text-slate-400">{r.primary_position}</span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange" />
                Suplentes ({suplentes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suplentes.length === 0 && (
                <p className="text-sm text-slate-400 py-4 text-center">Sin suplentes</p>
              )}

              {suplentes.map((r, i) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"
                  data-testid={`suplente-${r.player_id}`}
                >
                  <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>

                  <Avatar className="w-9 h-9">
                    <AvatarImage src={r.player_photo ? `${API_URL}${r.player_photo}` : undefined} />
                    <AvatarFallback className="bg-orange/10 text-orange text-xs font-bold">
                      {r.player_name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/jugadores/${r.player_id}`}
                      className="text-sm font-medium text-slate-900 hover:text-turf truncate block"
                    >
                      {r.player_name}
                    </Link>
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