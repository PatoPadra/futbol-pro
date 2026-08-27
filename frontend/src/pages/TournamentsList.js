import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trophy, Users } from 'lucide-react';

import api from '../lib/api';
import { Button } from '../components/ui/button';
import PageHeader from '@/components/common/PageHeader';
import PageLoader from '@/components/common/PageLoader';
import EmptyState from '@/components/common/EmptyState';
import Reveal from '@/components/common/Reveal';
import { useAuth } from '@/contexts/AuthContext';
import { useCapacidades } from '@/hooks/use-capacidades';
import { estadoDe, formatoDe } from '@/constants/torneos';
import { cn } from '@/lib/utils';

/**
 * Los torneos que juego o que organizo.
 *
 * Un torneo acá es un "grupo de grupos": cada grupo entra como un equipo. La
 * lista muestra cuántos equipos tiene y en qué instancia está, que es lo único
 * que se necesita para decidir en cuál entrar.
 */
export default function TournamentsList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [torneos, setTorneos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { puedeCrearTorneo } = useCapacidades();
  const [error, setError] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(false);
    api.get('/tournaments')
      .then((res) => setTorneos(res.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Los torneos los arma quien organiza algun grupo, no quien tiene el rol
  // global. Es el mismo criterio que aplica el backend.
  const puedeCrear = puedeCrearTorneo;

  if (loading) return <div data-testid="tournaments-loading"><PageLoader /></div>;

  return (
    <div className="page-container mx-auto max-w-3xl" data-testid="tournaments-page">
      <PageHeader
        slug="torneos"
        priority
        icono={Trophy}
        eyebrow="Grupos que compiten entre sí"
        titulo="Torneos"
        bajada="Un torneo junta varios grupos y los hace jugar entre ellos. Cada grupo es un equipo."
        volverA="/dashboard"
        volverLabel="Inicio"
        testId="tournaments-header"
        acciones={puedeCrear ? (
          <Button
            shape="pill"
            onClick={() => navigate('/torneos/crear')}
            data-testid="create-tournament-btn"
            className="glass-dark h-11 border border-white/25 bg-white/10 px-5 text-white hover:bg-white/20 focus-visible:ring-white focus-visible:ring-offset-transparent"
          >
            <Plus className="mr-1 h-4 w-4" /> Crear torneo
          </Button>
        ) : null}
      />

      {error ? (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-center" data-testid="tournaments-error">
          <p className="text-sm text-red-700">No pudimos cargar los torneos.</p>
          <Button variant="outline" shape="pill" onClick={cargar} className="mt-3 h-11 bg-white px-5">
            Reintentar
          </Button>
        </div>
      ) : torneos.length === 0 ? (
        <EmptyState
          className="mt-6"
          variante={2}
          icono={Trophy}
          titulo="Todavía no hay torneos"
          descripcion={
            puedeCrear
              ? 'Armá uno y elegí qué grupos van a competir. Podés hacer una liga, zonas con eliminatoria, o llaves directas.'
              : 'Cuando el organizador de tu grupo arme un torneo, te va a aparecer acá.'
          }
          accion={puedeCrear ? (
            <Button
              shape="pill"
              onClick={() => navigate('/torneos/crear')}
              data-testid="empty-create-tournament-btn"
              className="h-12 bg-turf-btn px-6 text-white shadow-lift-turf hover:bg-turf-btn-dark"
            >
              <Plus className="mr-1 h-4 w-4" /> Crear el primero
            </Button>
          ) : null}
          testId="tournaments-empty"
        />
      ) : (
        <ul className="mt-6 space-y-3" data-testid="tournaments-list">
          {torneos.map((t, i) => (
            <Reveal key={t.id} from="up" delay={i * 50} className="block">
              <TorneoCard torneo={t} />
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}

function TorneoCard({ torneo }) {
  const estado = estadoDe(torneo.status);
  const formato = formatoDe(torneo.format);

  return (
    <li>
      <Link
        to={`/torneos/${torneo.id}`}
        data-testid={`tournament-card-${torneo.id}`}
        className="block rounded-3xl border border-slate-100 bg-white p-4 shadow-lift transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-turf/10 text-turf-accessible"
          >
            <Trophy className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="truncate font-heading text-lg font-bold uppercase leading-tight tracking-tight text-slate-900">
              {torneo.name}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {formato?.label || torneo.format_label}
              {formato?.resumen ? ` · ${formato.resumen}` : ''}
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                  estado.clase,
                )}
              >
                {estado.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {torneo.teams_count} {torneo.teams_count === 1 ? 'equipo' : 'equipos'}
              </span>
              {torneo.champion_name && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange/30 bg-orange/10 px-2.5 py-1 text-xs font-semibold text-orange-accessible">
                  Campeón: {torneo.champion_name}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
