import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Trophy, Users } from 'lucide-react';

import api from '../lib/api';
import { getMatchStatusLabel, getMatchStatusStyle, getModalityLabel, isActiveMatchStatus, isPastMatchStatus } from '../constants/matches';
import PageLoader from '../components/common/PageLoader';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

function MatchCard({ match }) {
  return (
    <Link to={`/partidos/${match.id}`} data-testid={`match-list-card-${match.id}`}>
      <Card className="border-slate-100 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3 gap-2">
            <Badge className={`text-xs font-semibold border ${getMatchStatusStyle(match.status)}`}>
              {getMatchStatusLabel(match.status)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {getModalityLabel(match.modality)}
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
}

export default function MatchesList() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/matches')
      .then((res) => setMatches(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upcoming = useMemo(() => matches.filter((match) => isActiveMatchStatus(match.status)), [matches]);
  const past = useMemo(() => matches.filter((match) => isPastMatchStatus(match.status)), [matches]);

  if (loading) return <PageLoader />;

  return (
    <div className="page-container" data-testid="matches-list-page">
      <div className="animate-slide-up">
        <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight mb-6">Partidos</h1>

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
                {upcoming.map((match) => <MatchCard key={match.id} match={match} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pasados">
            {past.length === 0 ? (
              <Card className="border-dashed border-slate-200">
                <CardContent className="p-8 text-center text-slate-400">No hay partidos pasados</CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {past.map((match) => <MatchCard key={match.id} match={match} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
