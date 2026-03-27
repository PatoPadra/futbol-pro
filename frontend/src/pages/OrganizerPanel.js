import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, Plus, Settings, Users } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { MATCH_STATUS_LABELS } from '@/constants/matches';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import PageLoader from '@/components/common/PageLoader';

export default function OrganizerPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [matchesRes, playersRes, groupsRes] = await Promise.all([
          api.get('/matches'),
          api.get('/players'),
          api.get('/groups'),
        ]);
        setMatches(matchesRes.data || []);
        setPlayers(playersRes.data || []);
        setGroups(groupsRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const myGroups = groups;

  const canManageGroup = (group) =>
    user?.role === 'admin' || group.my_member_role === 'organizador';

  const canOrganizeMatch = (match) =>
    user?.role === 'admin' || match.my_group_role === 'organizador';

  const myMatches = matches.filter(canOrganizeMatch);
  const activeMatches = myMatches.filter((match) =>
    ['abierto', 'cerrado', 'equipos_generados', 'equipos_confirmados'].includes(match.status)
  );
  const pastMatches = myMatches.filter((match) =>
    ['finalizado', 'completado', 'cancelado'].includes(match.status)
  );

  const guests = players.filter((player) => player.player_type === 'invitado');

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="page-container" data-testid="organizer-panel">
      <div className="animate-slide-up">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">
              Panel Organizador
            </h1>
            <p className="mt-1 text-slate-500">
              {myMatches.length} partidos gestionables · {myGroups.length} grupos
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => navigate('/grupos/crear')}
              variant="outline"
              className="rounded-full px-6 font-bold uppercase"
            >
              <Users className="w-4 h-4 mr-1.5" /> Nuevo Grupo
            </Button>

            <Button
              onClick={() => navigate('/partidos/crear')}
              className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase"
              data-testid="org-create-match"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Nuevo Partido
            </Button>
          </div>
        </div>

        <Tabs defaultValue="grupos" className="space-y-6">
          <TabsList className="w-full grid grid-cols-4 h-12 bg-slate-100 rounded-xl">
            <TabsTrigger value="grupos" className="rounded-lg font-semibold text-sm">
              Grupos ({myGroups.length})
            </TabsTrigger>
            <TabsTrigger value="activos" className="rounded-lg font-semibold text-sm">
              Activos ({activeMatches.length})
            </TabsTrigger>
            <TabsTrigger value="pasados" className="rounded-lg font-semibold text-sm">
              Pasados ({pastMatches.length})
            </TabsTrigger>
            <TabsTrigger value="jugadores" className="rounded-lg font-semibold text-sm">
              Jugadores ({players.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grupos">
            {myGroups.length === 0 && (
              <Card className="border-dashed border-slate-200">
                <CardContent className="p-8 text-center text-slate-400">
                  No pertenecés a ningún grupo todavía
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myGroups.map((group) => {
                const manageable = canManageGroup(group);

                return (
                  <Link to={`/grupos/${group.id}`} key={group.id}>
                    <Card className="border-slate-100 hover:shadow-sm cursor-pointer transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-heading text-xl font-bold uppercase tracking-tight">
                              {group.name}
                            </h3>

                            <p className="text-xs text-slate-500 mt-1">
                              {group.members_count} miembros
                            </p>

                            <p className="text-[11px] text-slate-400 mt-2">
                              {manageable
                                ? 'Podés administrar este grupo'
                                : 'Podés entrar al grupo y cargar puntajes iniciales'}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="outline">
                              {group.my_group_permission === 'organizador' ? 'Organizador' : 'Miembro'}
                            </Badge>

                            <Badge variant="outline">
                              {group.my_membership_type === 'invitado' ? 'Invitado' : 'Frecuente'}
                            </Badge>

                            {group.my_global_role === 'admin' && (
                              <Badge className="bg-slate-900 text-white">Admin</Badge>
                            )}

                            {manageable && (
                              <Badge className="text-xs bg-turf/10 text-turf border-turf/20">
                                Gestionable
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="activos">
            {activeMatches.length === 0 && (
              <Card className="border-dashed border-slate-200">
                <CardContent className="p-8 text-center text-slate-400">
                  No hay partidos activos
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {activeMatches.map((match) => (
                <Card
                  key={match.id}
                  className="border-slate-100 hover:shadow-md transition-shadow"
                  data-testid={`org-match-${match.id}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {`F${match.modality}`}
                          </Badge>

                          <Badge className="text-xs bg-turf/10 text-turf border-turf/20">
                            {MATCH_STATUS_LABELS[match.status] || match.status}
                          </Badge>
                        </div>

                        <h3 className="font-heading text-xl font-bold uppercase tracking-tight">
                          {match.title}
                        </h3>

                        {match.group_name && (
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mt-1">
                            Grupo: {match.group_name}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {match.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {match.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {match.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {match.titular_count}/{match.max_players}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link to={`/partidos/${match.id}`}>
                          <Button size="sm" variant="outline" className="rounded-full text-xs">
                            <Settings className="w-3 h-3 mr-1" /> Gestionar
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pasados">
            {pastMatches.length === 0 && (
              <Card className="border-dashed border-slate-200">
                <CardContent className="p-8 text-center text-slate-400">
                  No hay partidos pasados
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {pastMatches.map((match) => (
                <Link to={`/partidos/${match.id}`} key={match.id}>
                  <Card className="border-slate-100 hover:shadow-sm cursor-pointer transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{match.title}</p>
                        <p className="text-xs text-slate-500">
                          {match.date} - {`F${match.modality}`}
                        </p>
                        {match.group_name && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            Grupo: {match.group_name}
                          </p>
                        )}
                      </div>

                      <Badge className="text-xs">
                        {MATCH_STATUS_LABELS[match.status] || match.status}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="jugadores">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-slate-500">
                {players.length} jugadores, {guests.length} invitados
              </p>

              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/invitar-jugador')}
                className="rounded-full text-xs"
                data-testid="org-invite-guest"
              >
                <Plus className="w-3 h-3 mr-1" /> Invitar
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {players.slice(0, 50).map((player) => (
                <Link to={`/jugadores/${player.id}`} key={player.id}>
                  <Card className="border-slate-100 hover:shadow-sm cursor-pointer transition-shadow">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {player.name?.substring(0, 2).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{player.name}</p>
                        <p className="text-xs text-slate-400">
                          {player.primary_position || 'Sin posicion'} - {player.matches_played} partidos
                        </p>
                      </div>

                      <Badge variant="outline" className="text-[10px]">
                        {player.player_type}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}