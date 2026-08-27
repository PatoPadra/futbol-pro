import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertCircle, CalendarDays, History, Plus, RefreshCw, Trophy } from 'lucide-react';

import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import Reveal from '@/components/common/Reveal';
import MatchListCard from '@/components/matches/MatchListCard';
import MetaChip from '@/components/matches/MetaChip';

const TAB_TRIGGER =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 font-heading text-xs font-bold uppercase tracking-[0.12em] text-slate-600 transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 data-[state=active]:bg-white data-[state=active]:text-turf-accessible data-[state=active]:shadow-sm motion-reduce:transition-none sm:text-sm';

const TAB_COUNT =
  'inline-flex min-w-[22px] items-center justify-center rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-700';

function MatchesListSkeleton() {
  return (
    <div className="page-container" data-testid="matches-list-skeleton">
      <div className="animate-pulse">
        <div className="mb-6 h-[150px] rounded-3xl bg-slate-200 md:h-[190px]" />
        <div className="mb-6 h-14 w-full rounded-2xl bg-slate-100 sm:w-80" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl border border-slate-100 bg-slate-100" />
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
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-7 w-7 text-red-500" aria-hidden="true" />
          </div>
          <h2 className="mb-2 font-heading text-2xl font-bold uppercase tracking-tight text-slate-900">
            No pudimos cargar los partidos
          </h2>
          <p className="mb-6 max-w-sm text-slate-600">
            Revisá tu conexión a internet e intentá de nuevo.
          </p>
          <Button
            onClick={loadMatches}
            data-testid="matches-list-retry-btn"
            shape="pill"
            className="h-11 bg-turf-btn px-8 text-white shadow-lg shadow-turf/20 hover:bg-turf-btn-dark focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" data-testid="matches-list-page">
      <div className="animate-slide-up space-y-6">
        <PageHeader
          slug="partidos"
          eyebrow="Todas tus fechas"
          titulo="Partidos"
          bajada="Los partidos de tus grupos, los que se vienen y los que ya se jugaron."
          volverA="/dashboard"
          volverLabel="Inicio"
          icono={Trophy}
          testId="matches-list-header"
          meta={
            <>
              <MetaChip icono={CalendarDays} tono="turf">
                {upcoming.length} {upcoming.length === 1 ? 'próximo' : 'próximos'}
              </MetaChip>
              <MetaChip icono={History} tono="apagado">
                {past.length} {past.length === 1 ? 'jugado' : 'jugados'}
              </MetaChip>
            </>
          }
          acciones={
            <Link to="/partidos/crear" className="rounded-full focus-visible:outline-none">
              <Button
                shape="pill"
                className="h-11 bg-turf-btn px-5 text-white shadow-lg shadow-turf/25 hover:bg-turf-btn-dark focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                data-testid="matches-list-create-btn"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Crear partido
              </Button>
            </Link>
          }
        />

        <Tabs defaultValue="proximos">
          <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-slate-200/80 bg-slate-100 p-1 shadow-sm sm:inline-grid sm:w-auto">
            <TabsTrigger value="proximos" className={TAB_TRIGGER} data-testid="matches-tab-proximos">
              Próximos <span className={TAB_COUNT}>{upcoming.length}</span>
            </TabsTrigger>
            <TabsTrigger value="pasados" className={TAB_TRIGGER} data-testid="matches-tab-pasados">
              Pasados <span className={TAB_COUNT}>{past.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proximos">
            {upcoming.length === 0 ? (
              <EmptyState
                variante={0}
                icono={CalendarDays}
                titulo="Todavía no hay partidos próximos"
                descripcion="Cuando alguien de tus grupos arme una fecha, va a aparecer acá. Si organizás vos, creá el partido y compartí el link."
                testId="matches-empty-proximos"
                accion={
                  <Link to="/partidos/crear" className="rounded-full focus-visible:outline-none">
                    <Button
                      shape="pill"
                      className="h-11 bg-turf-btn px-6 text-white shadow-lg shadow-turf/25 hover:bg-turf-btn-dark focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Crear un partido
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((m, i) => (
                  <Reveal key={m.id} from="up" delay={Math.min(i, 5) * 60} className="h-full">
                    <MatchListCard match={m} />
                  </Reveal>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pasados">
            {past.length === 0 ? (
              <EmptyState
                variante={1}
                icono={History}
                titulo="Todavía no jugaste ninguno"
                descripcion="Acá se van a guardar los partidos finalizados, con sus estadísticas y sus equipos, para poder mirarlos después."
                testId="matches-empty-pasados"
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {past.map((m, i) => (
                  <Reveal key={m.id} from="up" delay={Math.min(i, 5) * 60} className="h-full">
                    <MatchListCard match={m} />
                  </Reveal>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
