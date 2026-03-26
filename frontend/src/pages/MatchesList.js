import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Trophy, Users } from 'lucide-react';

import api from '../lib/api';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import PageLoader from '../components/common/PageLoader';
import { MATCH_STATUS_LABELS, MATCH_STATUS_STYLES, MODALITY_LABELS, PAST_MATCH_STATUSES, UPCOMING_MATCH_STATUSES } from '../constants/matches';

export default function MatchesList() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/matches')
      .then((res) => setMatches(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upcoming = matches.filter((match) => UPCOMING_MATCH_STATUSES.includes(match.status));
  const past = matches.filter((match) => PAST_MATCH_STATUSES.includes(match.status));

  if (loading) {
    return <PageLoader label="Cargando partidos..." />;
  }

  const MatchCard = ({ match }) => (
    <Link to={`/partidos/${match.id}`} data-testid={`match-list-card-${match.id}`}>
      <Card className="border-slate-100 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3 gap-2">
            <Badge className={`text-xs font-semibold border ${MATCH_STATUS_STYLES[match.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {MATCH_STATUS_LABELS[match.status] || match.status}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {MODALITY_LABELS[match.modality] || `Futbol ${match.modality}`}
            </Badge>
          </div>

          <h3 className="font-heading text-lg font-bold uppercase tracking-tight text-slate-900 mb-1">
            {match.title}
          </h3>

          {match.group_name && (
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
              Grupo: {match.group_name}
            </p>
          )}

          <div className="space-y-1.5 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              {match.date}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              {match.time}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" />
              {match.location}
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              {match.titular_count}/{match.max_players} titulares
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="page-container" data-testid="matches-list-page">
      <div className="animate-slide-up space-y-6">
        <section className="rounded-[28px] border border-slate-100 bg-white p-6 md:p-7 shadow-sm shadow-slate-100/80">
          <h1 className="font-heading text-3xl md:text-5xl font-bold uppercase tracking-tight text-slate-900">
            Partidos
          </h1>
          <p className="text-slate-500 mt-2 max-w-2xl">
            Seguí la agenda, revisá estados rápido y abrí cada partido con contexto claro.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Total', value: matches.length },
              { label: 'Próximos', value: upcoming.length },
              { label: 'Cerrados o jugados', value: past.length },
              { label: 'Con equipos confirmados', value: matches.filter((match) => match.status === 'equipos_confirmados').length },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <Tabs defaultValue="proximos">
          <TabsList className="w-full grid grid-cols-2 h-12 bg-slate-100 rounded-xl mb-6">
            <TabsTrigger value="proximos" className="rounded-lg font-semibold text-sm">
              Próximos ({upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="pasados" className="rounded-lg font-semibold text-sm">
              Historial ({past.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proximos">
            {upcoming.length === 0 ? (
              <Card className="border-dashed border-slate-200">
                <CardContent className="p-8 text-center">
                  <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">No hay partidos próximos</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {upcoming.map((match) => <MatchCard key={match.id} match={match} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pasados">
            {past.length === 0 ? (
              <Card className="border-dashed border-slate-200">
                <CardContent className="p-8 text-center text-slate-400">
                  No hay partidos cerrados todavía
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {past.map((match) => <MatchCard key={match.id} match={match} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
