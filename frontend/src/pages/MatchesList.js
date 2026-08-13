import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calendar, Clock, MapPin, Users, Trophy, AlertCircle, RefreshCw } from 'lucide-react';

import { MATCH_STATUS_BADGE_CLASS, MATCH_STATUS_LABELS, MODALITY_LABELS } from '@/constants/matches';

const CARD_LINK_FOCUS = 'block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2';

function MatchesListSkeleton() {
  return (
    <div className="page-container" data-testid="matches-list-skeleton">
      <div className="animate-pulse">
        <div className="h-9 w-48 bg-slate-200 rounded-lg mb-6" />
        <div className="h-12 w-full bg-slate-100 rounded-xl mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-slate-100 rounded-xl border border-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MatchesList() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadMatches = () => {
    setLoading(true);
    setError(false);
    api.get('/matches')
      .then(res => setMatches(res.data || []))
      .catch(() => {
        setError(true);
        toast.error('No pudimos cargar los partidos. Revisá tu conexión e intentá de nuevo.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const upcoming = matches.filter(m =>
    ['abierto', 'cerrado', 'equipos_generados', 'equipos_confirmados'].includes(m.status)
  );
  const past = matches.filter(m =>
    ['finalizado', 'completado', 'cancelado'].includes(m.status)
  );

  if (loading) {
    return <MatchesListSkeleton />;
  }

  if (error) {
    return (
      <div className="page-container" data-testid="matches-list-error">
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="font-heading text-2xl font-bold uppercase tracking-tight text-slate-900 mb-2">
            No pudimos cargar los partidos
          </h2>
          <p className="text-slate-500 mb-6 max-w-sm">
            Revisá tu conexión a internet e intentá de nuevo.
          </p>
          <Button
            onClick={loadMatches}
            data-testid="matches-list-retry-btn"
            className="h-11 px-8 bg-turf hover:bg-turf-dark text-white rounded-full font-bold uppercase tracking-wider transition-transform active:scale-95 shadow-lg shadow-turf/20 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const MatchCard = ({ m }) => {
    const spotsLeft = m.max_players - m.titular_count;
    const isFull = spotsLeft <= 0;
    return (
      <Link to={`/partidos/${m.id}`} data-testid={`match-list-card-${m.id}`} className={CARD_LINK_FOCUS}>
        <Card className="border-slate-100 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 active:scale-[0.98] cursor-pointer h-full">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3 gap-2">
              <Badge className={`text-xs font-semibold border ${MATCH_STATUS_BADGE_CLASS[m.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {MATCH_STATUS_LABELS[m.status] || m.status}
              </Badge>
              <Badge variant="outline" className="text-xs shrink-0">
                {MODALITY_LABELS[m.modality] || `Fútbol ${m.modality}`}
              </Badge>
            </div>

            <h3 className="font-heading text-lg font-bold uppercase tracking-tight text-slate-900 mb-1">
              {m.title}
            </h3>

            {m.group_name && (
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3 truncate">
                Grupo: {m.group_name}
              </p>
            )}

            <div className="space-y-1.5 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                {m.date}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {m.time}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{m.location}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className={isFull ? 'font-semibold text-slate-700' : ''}>{m.titular_count}/{m.max_players} titulares</span>
                {isFull ? (
                  <Badge className="text-[10px] px-1.5 py-0 bg-slate-900 text-white border-0">Completo</Badge>
                ) : (
                  <span className="text-slate-400">· {spotsLeft} {spotsLeft === 1 ? 'lugar libre' : 'lugares libres'}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  return (
    <div className="page-container" data-testid="matches-list-page">
      <div className="animate-slide-up">
        <h1 className="font-heading text-4xl md:text-5xl font-bold uppercase tracking-tight mb-6">
          Partidos
        </h1>

        <Tabs defaultValue="proximos">
          <TabsList className="w-full grid grid-cols-2 h-12 bg-slate-100 rounded-xl mb-6">
            <TabsTrigger value="proximos" className="rounded-lg font-semibold text-sm" data-testid="matches-tab-proximos">
              Próximos ({upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="pasados" className="rounded-lg font-semibold text-sm" data-testid="matches-tab-pasados">
              Pasados ({past.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proximos">
            {upcoming.length === 0 ? (
              <Card className="border-dashed border-slate-200">
                <CardContent className="p-8 text-center">
                  <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">Todavía no tenés partidos próximos</p>
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
                <CardContent className="p-8 text-center">
                  <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">Todavía no tenés partidos pasados</p>
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
