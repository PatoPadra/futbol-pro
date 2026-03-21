import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calendar, Clock, MapPin, Users, Trophy } from 'lucide-react';

const MOD_LABELS = { 5: 'Futbol 5', 6: 'Futbol 6', 7: 'Futbol 7', 8: 'Futbol 8', 9: 'Futbol 9', 10: 'Futbol 10', 11: 'Futbol 11' };
const STATUS_COLORS = {
  abierto: 'bg-turf/10 text-turf border-turf/20',
  cerrado: 'bg-orange/10 text-orange border-orange/20',
  equipos_generados: 'bg-blue-50 text-blue-600 border-blue-200',
  equipos_confirmados: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  finalizado: 'bg-slate-100 text-slate-600 border-slate-200',
  completado: 'bg-slate-50 text-slate-400 border-slate-200',
};
const STATUS_LABELS = {
  abierto: 'Abierto',
  cerrado: 'Cerrado',
  equipos_generados: 'Equipos Generados',
  equipos_confirmados: 'Confirmado',
  finalizado: 'Finalizado',
  completado: 'Completado',
};

export default function MatchesList() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/matches')
      .then(res => setMatches(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upcoming = matches.filter(m =>
    ['abierto', 'cerrado', 'equipos_generados', 'equipos_confirmados'].includes(m.status)
  );
  const past = matches.filter(m =>
    ['finalizado', 'completado'].includes(m.status)
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const MatchCard = ({ m }) => (
    <Link to={`/partidos/${m.id}`} data-testid={`match-list-card-${m.id}`}>
      <Card className="border-slate-100 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3 gap-2">
            <Badge className={`text-xs font-semibold border ${STATUS_COLORS[m.status] || 'bg-slate-100'}`}>
              {STATUS_LABELS[m.status] || m.status}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {MOD_LABELS[m.modality] || `Futbol ${m.modality}`}
            </Badge>
          </div>

          <h3 className="font-heading text-lg font-bold uppercase tracking-tight text-slate-900 mb-1">
            {m.title}
          </h3>

          {m.group_name && (
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
              Grupo: {m.group_name}
            </p>
          )}

          <div className="space-y-1.5 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              {m.date}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              {m.time}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" />
              {m.location}
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              {m.titular_count}/{m.max_players} titulares
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="page-container" data-testid="matches-list-page">
      <div className="animate-slide-up">
        <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight mb-6">
          Partidos
        </h1>

        <Tabs defaultValue="proximos">
          <TabsList className="w-full grid grid-cols-2 h-12 bg-slate-100 rounded-xl mb-6">
            <TabsTrigger value="proximos" className="rounded-lg font-semibold text-sm">
              Proximos ({upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="pasados" className="rounded-lg font-semibold text-sm">
              Pasados ({past.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proximos">
            {upcoming.length === 0 ? (
              <Card className="border-dashed border-slate-200">
                <CardContent className="p-8 text-center">
                  <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">No hay partidos proximos</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map(m => <MatchCard key={m.id} m={m} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pasados">
            {past.length === 0 ? (
              <Card className="border-dashed border-slate-200">
                <CardContent className="p-8 text-center text-slate-400">
                  No hay partidos pasados
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {past.map(m => <MatchCard key={m.id} m={m} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}