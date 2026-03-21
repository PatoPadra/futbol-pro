import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plus, Calendar, Users, Settings, MapPin, Clock } from 'lucide-react';

const MOD_LABELS = { 5: 'F5', 6: 'F6', 7: 'F7', 8: 'F8', 9: 'F9', 10: 'F10', 11: 'F11' };
const STATUS_LABELS = {
  abierto: 'Abierto',
  cerrado: 'Cerrado',
  equipos_generados: 'Equipos',
  equipos_confirmados: 'Confirmado',
  finalizado: 'Finalizado',
  completado: 'Completado'
};

export default function OrganizerPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [mRes, pRes] = await Promise.all([
          api.get('/matches'),
          api.get('/players'),
        ]);
        setMatches(mRes.data || []);
        setPlayers(pRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const canOrganizeMatch = (m) => user?.role === 'admin' || m.my_group_role === 'organizador';

  const myMatches = matches.filter(canOrganizeMatch);
  const activeMatches = myMatches.filter(m =>
    ['abierto', 'cerrado', 'equipos_generados', 'equipos_confirmados'].includes(m.status)
  );
  const pastMatches = myMatches.filter(m =>
    ['finalizado', 'completado'].includes(m.status)
  );

  // Esto queda realmente correcto cuando /players tambien quede filtrado por grupos en backend
  const guests = players.filter(p => p.player_type === 'invitado');

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container" data-testid="organizer-panel">
      <div className="animate-slide-up">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">
              Panel Organizador
            </h1>
            <p className="mt-1 text-slate-500">{myMatches.length} partidos gestionables</p>
          </div>
          <Button
            onClick={() => navigate('/partidos/crear')}
            className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase"
            data-testid="org-create-match"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Nuevo Partido
          </Button>
        </div>

        <Tabs defaultValue="activos" className="space-y-6">
          <TabsList className="w-full grid grid-cols-3 h-12 bg-slate-100 rounded-xl">
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

          <TabsContent value="activos">
            {activeMatches.length === 0 && (
              <Card className="border-dashed border-slate-200">
                <CardContent className="p-8 text-center text-slate-400">
                  No hay partidos activos
                </CardContent>
              </Card>
            )}
            <div className="space-y-4">
              {activeMatches.map(m => (
                <Card
                  key={m.id}
                  className="border-slate-100 hover:shadow-md transition-shadow"
                  data-testid={`org-match-${m.id}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {MOD_LABELS[m.modality] || `F${m.modality}`}
                          </Badge>
                          <Badge className="text-xs bg-turf/10 text-turf border-turf/20">
                            {STATUS_LABELS[m.status] || m.status}
                          </Badge>
                        </div>

                        <h3 className="font-heading text-xl font-bold uppercase tracking-tight">
                          {m.title}
                        </h3>

                        {m.group_name && (
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mt-1">
                            Grupo: {m.group_name}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {m.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {m.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {m.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {m.titular_count}/{m.max_players}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link to={`/partidos/${m.id}`}>
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
              {pastMatches.map(m => (
                <Link to={`/partidos/${m.id}`} key={m.id}>
                  <Card className="border-slate-100 hover:shadow-sm cursor-pointer transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{m.title}</p>
                        <p className="text-xs text-slate-500">
                          {m.date} - {MOD_LABELS[m.modality] || `F${m.modality}`}
                        </p>
                        {m.group_name && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            Grupo: {m.group_name}
                          </p>
                        )}
                      </div>
                      <Badge className="text-xs">
                        {STATUS_LABELS[m.status] || m.status}
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
              {players.slice(0, 50).map(p => (
                <Link to={`/jugadores/${p.id}`} key={p.id}>
                  <Card className="border-slate-100 hover:shadow-sm cursor-pointer transition-shadow">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {p.name?.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-slate-400">
                          {p.primary_position || 'Sin posicion'} - {p.matches_played} partidos
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {p.player_type}
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