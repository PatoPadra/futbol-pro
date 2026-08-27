import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  CalendarClock,
  ChevronRight,
  Clock,
  History,
  MapPin,
  Plus,
  Repeat,
  Settings,
  Shield,
  Trophy,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { MATCH_STATUS_ACCENT_BORDER, MODALITY_LABELS } from '@/constants/matches';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import PageLoader from '@/components/common/PageLoader';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import PanelSection from '@/components/panels/PanelSection';
import CounterTiles from '@/components/panels/CounterTiles';
import PanelSearch from '@/components/panels/PanelSearch';
import { EstadoChip, MetaChip } from '@/components/panels/StatusChip';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';

const TAB_TRIGGER_CLASS =
  'h-10 rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm sm:text-sm';

export default function OrganizerPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(false);
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
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const filteredPlayers = useMemo(() => {
    const term = playerSearch.trim().toLowerCase();
    if (!term) return players;
    return players.filter((player) => player.name?.toLowerCase().includes(term));
  }, [players, playerSearch]);

  const visiblePlayers = filteredPlayers.slice(0, 50);

  if (loading) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <div className="page-container" data-testid="organizer-panel">
        <PageHeader
          slug="organizador"
          eyebrow="Herramientas"
          titulo="Panel Organizador"
          bajada="Grupos, partidos y jugadores en un solo lugar."
          volverA="/dashboard"
          volverLabel="Inicio"
          icono={Settings}
        />

        <EmptyState
          variante={3}
          icono={Trophy}
          titulo="No pudimos cargar el panel"
          descripcion="Se cayó alguna de las consultas de partidos, jugadores o grupos. Probá de nuevo en un momento."
          className="mt-6"
          accion={
            <Button
              onClick={load}
              variant="outline"
              shape="pill"
              className="border-2 border-white/70 bg-white/10 px-6 text-white hover:bg-white/20 hover:text-white"
              data-testid="org-retry"
            >
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  const tiles = [
    { key: 'grupos', label: 'Grupos', value: myGroups.length, icon: Users, tone: 'charcoal' },
    { key: 'gestionables', label: 'Gestionables', value: myMatches.length, icon: Settings, tone: 'slate' },
    { key: 'activos', label: 'Activos', value: activeMatches.length, icon: CalendarClock, tone: 'turf' },
    { key: 'pasados', label: 'Pasados', value: pastMatches.length, icon: History, tone: 'slate' },
    { key: 'jugadores', label: 'Jugadores', value: players.length, icon: Users, tone: 'slate' },
    { key: 'invitados', label: 'Invitados', value: guests.length, icon: UserCog, tone: 'orange' },
  ];

  return (
    <div className="page-container" data-testid="organizer-panel">
      <div className="animate-slide-up motion-reduce:animate-none">
        <PageHeader
          slug="organizador"
          eyebrow="Herramientas"
          titulo="Panel Organizador"
          bajada={`${myMatches.length} partidos gestionables · ${myGroups.length} grupos`}
          volverA="/dashboard"
          volverLabel="Inicio"
          icono={Settings}
          acciones={
            <>
              <Button
                onClick={() => navigate('/grupos/crear')}
                variant="outline"
                shape="pill"
                className="border-2 border-white/60 bg-white/10 px-5 text-white backdrop-blur hover:bg-white/20 hover:text-white"
                data-testid="org-create-group"
              >
                <Users className="h-4 w-4" aria-hidden="true" /> Nuevo Grupo
              </Button>

              <Button
                onClick={() => navigate('/partidos/crear')}
                shape="pill"
                className="bg-turf-btn px-5 text-white hover:bg-turf-btn-dark"
                data-testid="org-create-match"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo Partido
              </Button>
            </>
          }
        />

        <CounterTiles className="mt-6" items={tiles} />

        <Tabs defaultValue="grupos" className="mt-6 space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-4">
            <TabsTrigger value="grupos" className={TAB_TRIGGER_CLASS} data-testid="org-tab-grupos">
              Grupos ({myGroups.length})
            </TabsTrigger>
            <TabsTrigger value="activos" className={TAB_TRIGGER_CLASS} data-testid="org-tab-activos">
              Activos ({activeMatches.length})
            </TabsTrigger>
            <TabsTrigger value="pasados" className={TAB_TRIGGER_CLASS} data-testid="org-tab-pasados">
              Pasados ({pastMatches.length})
            </TabsTrigger>
            <TabsTrigger value="jugadores" className={TAB_TRIGGER_CLASS} data-testid="org-tab-jugadores">
              Jugadores ({players.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grupos">
            {myGroups.length === 0 && (
              <div data-testid="org-groups-empty">
                <EmptyState
                  variante={4}
                  icono={Users}
                  titulo="Todavía no tenés grupos"
                  descripcion="Un grupo junta a los que juegan siempre: desde ahí armás las fechas y los equipos salen parejos."
                  accion={
                    <Button
                      onClick={() => navigate('/grupos/crear')}
                      shape="pill"
                      className="bg-turf-btn px-6 text-white hover:bg-turf-btn-dark"
                      data-testid="org-groups-empty-create"
                    >
                      Crear tu primer grupo
                    </Button>
                  }
                />
              </div>
            )}

            {myGroups.length > 0 && (
              <PanelSection
                icono={Users}
                tono="charcoal"
                titulo="Tus grupos"
                contador={myGroups.length}
                descripcion="Los grupos gestionables son los que podés administrar."
                sinPadding
              >
                <ul className="divide-y divide-slate-100">
                  {myGroups.map((group) => {
                    const manageable = canManageGroup(group);

                    return (
                      <li key={group.id} className="even:bg-slate-50/60">
                        <Link
                          to={`/grupos/${group.id}`}
                          className={`flex items-start gap-3 border-l-4 px-4 py-4 transition-colors hover:bg-turf/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-turf md:px-5 ${
                            manageable ? 'border-l-turf' : 'border-l-slate-200'
                          }`}
                          data-testid={`org-group-${group.id}`}
                        >
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-heading text-xl font-bold uppercase tracking-tight text-slate-900">
                              {group.name}
                            </h3>

                            <p className="mt-0.5 text-xs tabular-nums text-slate-600">
                              {group.members_count} miembros
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <MetaChip
                                icono={group.my_group_permission === 'organizador' ? Settings : Users}
                              >
                                {group.my_group_permission === 'organizador' ? 'Organizador' : 'Miembro'}
                              </MetaChip>

                              <MetaChip
                                tono={
                                  group.my_membership_type === 'invitado'
                                    ? 'border-orange/25 bg-orange/10 text-orange-accessible'
                                    : 'border-slate-200 bg-slate-50 text-slate-600'
                                }
                              >
                                {group.my_membership_type === 'invitado' ? 'Invitado' : 'Frecuente'}
                              </MetaChip>

                              {group.my_global_role === 'admin' && (
                                <MetaChip
                                  icono={Shield}
                                  tono="border-transparent bg-secondary text-secondary-foreground"
                                >
                                  Admin
                                </MetaChip>
                              )}

                              {manageable && (
                                <MetaChip
                                  icono={Settings}
                                  tono="border-turf/25 bg-turf/10 text-turf-accessible"
                                >
                                  Gestionable
                                </MetaChip>
                              )}
                            </div>

                            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                              {manageable
                                ? 'Podés administrar este grupo'
                                : 'Podés entrar al grupo y cargar puntajes iniciales'}
                            </p>
                          </div>

                          <ChevronRight
                            className="mt-1 h-4 w-4 shrink-0 text-slate-600"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </PanelSection>
            )}
          </TabsContent>

          <TabsContent value="activos">
            {activeMatches.length === 0 && (
              <div data-testid="org-active-matches-empty">
                <EmptyState
                  variante={5}
                  icono={CalendarClock}
                  titulo="No hay partidos activos"
                  descripcion="Ninguna fecha abierta por ahora. Armá una y empezá a sumar gente."
                  accion={
                    <Button
                      onClick={() => navigate('/partidos/crear')}
                      shape="pill"
                      className="bg-turf-btn px-6 text-white hover:bg-turf-btn-dark"
                      data-testid="org-active-matches-empty-create"
                    >
                      Crear Partido
                    </Button>
                  }
                />
              </div>
            )}

            {activeMatches.length > 0 && (
              <PanelSection
                icono={CalendarClock}
                tono="turf"
                titulo="Partidos activos"
                contador={activeMatches.length}
                descripcion="Fechas en juego: abiertas, cerradas o con equipos armados."
                sinPadding
              >
                <ul className="divide-y divide-slate-100">
                  {activeMatches.map((match) => (
                    <li
                      key={match.id}
                      data-testid={`org-match-${match.id}`}
                      className={`border-l-4 px-4 py-4 transition-colors even:bg-slate-50/60 hover:bg-turf/5 md:px-5 ${MATCH_STATUS_ACCENT_BORDER[match.status] || 'border-l-slate-200'}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            <EstadoChip status={match.status} />
                            <MetaChip>
                              {MODALITY_LABELS[match.modality] || `Futbol ${match.modality}`}
                            </MetaChip>
                          </div>

                          <h3 className="font-heading text-xl font-bold uppercase tracking-tight text-slate-900">
                            {match.title}
                          </h3>

                          {match.group_name && (
                            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Grupo: {match.group_name}
                            </p>
                          )}

                          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
                              <dt className="sr-only">Fecha</dt>
                              <dd className="tabular-nums">{match.date}</dd>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
                              <dt className="sr-only">Hora</dt>
                              <dd className="tabular-nums">{match.time}</dd>
                            </div>
                            <div className="flex min-w-0 items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
                              <dt className="sr-only">Lugar</dt>
                              <dd className="truncate">{match.location}</dd>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
                              <dt className="sr-only">Anotados</dt>
                              <dd className="font-semibold tabular-nums text-slate-800">
                                {match.titular_count}/{match.max_players}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <div className="flex gap-2">
                          <Link to={`/partidos/${match.id}`} data-testid={`org-manage-match-${match.id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              shape="pill"
                              className="border-slate-300 text-xs focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                            >
                              <Settings className="h-3.5 w-3.5" aria-hidden="true" /> Gestionar
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </PanelSection>
            )}
          </TabsContent>

          <TabsContent value="pasados">
            {pastMatches.length === 0 && (
              <div data-testid="org-past-matches-empty">
                <EmptyState
                  variante={0}
                  icono={History}
                  titulo="No hay partidos pasados"
                  descripcion="Cuando cierres una fecha, va a quedar acá con su resultado."
                />
              </div>
            )}

            {pastMatches.length > 0 && (
              <PanelSection
                icono={History}
                titulo="Partidos pasados"
                contador={pastMatches.length}
                descripcion="Fechas finalizadas, completadas o canceladas."
                sinPadding
              >
                <ul className="divide-y divide-slate-100">
                  {pastMatches.map((match) => (
                    <li key={match.id} className="even:bg-slate-50/60">
                      <Link
                        to={`/partidos/${match.id}`}
                        className={`flex min-h-[56px] items-center gap-3 border-l-4 px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-turf md:px-5 ${MATCH_STATUS_ACCENT_BORDER[match.status] || 'border-l-slate-200'}`}
                        data-testid={`org-past-match-${match.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{match.title}</p>
                          <p className="text-xs tabular-nums text-slate-600">
                            {match.date} · {MODALITY_LABELS[match.modality] || `Futbol ${match.modality}`}
                          </p>
                          {match.group_name && (
                            <p className="mt-0.5 truncate text-[11px] text-slate-600">
                              Grupo: {match.group_name}
                            </p>
                          )}
                        </div>

                        <EstadoChip status={match.status} className="shrink-0" />
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </PanelSection>
            )}
          </TabsContent>

          <TabsContent value="jugadores">
            <PanelSection
              icono={Users}
              titulo="Jugadores"
              contador={`${players.length} · ${guests.length} invitados`}
              descripcion="Todos los jugadores que podés convocar. Los invitados vienen de una sola fecha."
              sinPadding
              acciones={
                <Button
                  size="sm"
                  variant="outline"
                  shape="pill"
                  onClick={() => navigate('/invitar-jugador')}
                  className="border-slate-300 text-xs"
                  data-testid="org-invite-guest"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Invitar
                </Button>
              }
            >
              <div className="border-b border-slate-100 p-4 md:p-5">
                <PanelSearch
                  id="org-player-search-input"
                  label="Buscar jugador por nombre"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  onLimpiar={() => setPlayerSearch('')}
                  placeholder="Buscar jugador por nombre..."
                  resultados={filteredPlayers.length}
                  sustantivo="jugadores"
                  testId="org-player-search"
                />
              </div>

              {filteredPlayers.length === 0 ? (
                <div className="p-4 md:p-5" data-testid="org-players-empty">
                  <EmptyState
                    variante={1}
                    icono={Users}
                    titulo={playerSearch ? 'Sin resultados' : 'Todavía no hay jugadores'}
                    descripcion={
                      playerSearch
                        ? 'No encontramos jugadores con ese nombre. Probá con parte del nombre.'
                        : 'Todavía no hay jugadores para mostrar. Invitá a alguien y arrancá.'
                    }
                  />
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-slate-100">
                    {visiblePlayers.map((player) => (
                      <li key={player.id} className="even:bg-slate-50/60">
                        <Link
                          to={`/jugadores/${player.id}`}
                          className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-turf/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-turf md:px-5"
                          data-testid={`org-player-${player.id}`}
                        >
                          <Avatar className="h-9 w-9 shrink-0 ring-1 ring-slate-200">
                            <AvatarImage src={buildPhotoUrl(player.photo_url) || undefined} />
                            <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-600">
                              {initialsFromName(player.name)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{player.name}</p>
                            <p className="text-xs text-slate-600">
                              {player.primary_position || 'Sin posición'} ·{' '}
                              <span className="tabular-nums">{player.matches_played}</span> partidos
                            </p>
                          </div>

                          <MetaChip
                            icono={player.player_type === 'invitado' ? UserPlus : Repeat}
                            tono={
                              player.player_type === 'invitado'
                                ? 'border-orange/25 bg-orange/10 text-orange-accessible'
                                : 'border-turf/25 bg-turf/10 text-turf-accessible'
                            }
                            className="shrink-0"
                          >
                            {player.player_type === 'invitado' ? 'Invitado' : 'Frecuente'}
                          </MetaChip>

                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {filteredPlayers.length > visiblePlayers.length && (
                    <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center text-xs text-slate-600 md:px-5">
                      Mostrando <span className="font-semibold tabular-nums text-slate-700">{visiblePlayers.length}</span> de{' '}
                      <span className="font-semibold tabular-nums text-slate-700">{filteredPlayers.length}</span> jugadores.
                      Refiná tu búsqueda para ver más.
                    </p>
                  )}
                </>
              )}
            </PanelSection>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
