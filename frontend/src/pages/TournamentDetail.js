import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  ListOrdered,
  Loader2,
  Play,
  Swords,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import api from '../lib/api';
import { Button } from '../components/ui/button';
import PageHeader from '@/components/common/PageHeader';
import PageLoader from '@/components/common/PageLoader';
import PanelSection from '@/components/panels/PanelSection';
import Reveal from '@/components/common/Reveal';
import StandingsTable from '@/components/tournaments/StandingsTable';
import FixtureRow from '@/components/tournaments/FixtureRow';
import { estadoDe, formatoDe } from '@/constants/torneos';
import { cn } from '@/lib/utils';

const CHIP_SOBRE_FOTO =
  'glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white';

/** Las instancias de llaves, de la más lejana a la final. Define el orden en pantalla. */
const ORDEN_LLAVES = ['dieciseisavos', 'octavos', 'cuartos', 'semifinal', 'final'];

/**
 * El torneo entero en una pantalla: equipos, tabla y fixture.
 *
 * No hay pestañas a propósito. Cargar un resultado y mirar cómo quedó la tabla
 * son la misma acción partida en dos, y con pestañas obliga a ir y volver
 * después de cada carga. Todo va en una columna, en el orden en que se usa:
 * primero en qué anda el torneo, después la tabla, después los partidos.
 */
export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accion, setAccion] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const res = await api.get(`/tournaments/${id}`);
      setDatos(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'No pudimos cargar el torneo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const torneo = datos?.tournament;
  const equipos = useMemo(() => datos?.teams || [], [datos]);
  const fixtures = useMemo(() => datos?.fixtures || [], [datos]);
  const standings = useMemo(() => datos?.standings || [], [datos]);

  const puedeGestionar = !!torneo?.can_manage;

  const guardarResultado = async (fixtureId, local, visitante) => {
    try {
      const res = await api.put(`/tournaments/${id}/fixtures/${fixtureId}`, {
        home_score: local,
        away_score: visitante,
      });
      // El backend devuelve el fixture y la tabla recalculados: los usamos en vez
      // de volver a pedir el torneo entero, así cargar una fecha entera no son
      // seis GET completos.
      setDatos((prev) => ({
        ...prev,
        fixtures: res.data.fixtures,
        standings: res.data.standings,
        tournament: res.data.tournament,
      }));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos guardar el resultado');
      throw err;
    }
  };

  const generarFixture = async () => {
    setAccion('fixture');
    try {
      await api.post(`/tournaments/${id}/fixture`);
      toast.success('Fixture generado');
      await cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos generar el fixture');
    } finally {
      setAccion(null);
    }
  };

  const generarLlaves = async () => {
    setAccion('playoffs');
    try {
      const res = await api.post(`/tournaments/${id}/playoffs`);
      toast.success(`Llaves generadas con ${res.data.qualified?.length || 0} clasificados`);
      await cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos generar las llaves');
    } finally {
      setAccion(null);
    }
  };

  const sacarEquipo = async (teamId, nombre) => {
    setAccion(`team-${teamId}`);
    try {
      await api.delete(`/tournaments/${id}/teams/${teamId}`);
      toast.success(`${nombre} salió del torneo`);
      await cargar();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos sacar al equipo');
    } finally {
      setAccion(null);
    }
  };

  const borrarTorneo = async () => {
    setAccion('delete');
    try {
      await api.delete(`/tournaments/${id}`);
      toast.success('Torneo borrado');
      navigate('/torneos');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos borrar el torneo');
      setAccion(null);
    }
  };

  if (loading) return <div data-testid="tournament-loading"><PageLoader /></div>;

  if (error) {
    return (
      <div className="page-container mx-auto max-w-md text-center" data-testid="tournament-error">
        <p className="mt-10 text-slate-700">{error}</p>
        <Button shape="pill" onClick={() => navigate('/torneos')} className="mt-4 h-11 bg-turf px-5 text-white">
          Volver a torneos
        </Button>
      </div>
    );
  }

  const estado = estadoDe(torneo.status);
  const formato = formatoDe(torneo.format);

  // Zonas presentes en el fixture. Si el torneo es de zonas, la tabla se parte
  // en una por zona: una tabla única mezclando zonas no significa nada.
  const zonas = [...new Set(equipos.map((t) => t.zone).filter(Boolean))].sort();

  const deZonaOLiga = fixtures.filter((fx) => fx.stage === 'liga' || fx.stage === 'zona');
  const deLlaves = fixtures.filter((fx) => ORDEN_LLAVES.includes(fx.stage));

  const zonasCompletas = deZonaOLiga.length > 0 && deZonaOLiga.every((fx) => fx.status === 'jugado');
  const puedeGenerarLlaves =
    puedeGestionar &&
    torneo.format === 'zonas_eliminatoria' &&
    zonasCompletas &&
    deLlaves.length === 0;

  return (
    <div className="page-container mx-auto max-w-3xl" data-testid="tournament-detail-page">
      <PageHeader
        slug="torneo"
        priority
        icono={Trophy}
        eyebrow={formato?.label || torneo.format_label}
        titulo={torneo.name}
        bajada={formato?.resumen}
        volverA="/torneos"
        volverLabel="Torneos"
        testId="tournament-header"
        meta={(
          <>
            <span className={CHIP_SOBRE_FOTO}>{estado.label}</span>
            <span className={CHIP_SOBRE_FOTO}>
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {torneo.teams_count} {torneo.teams_count === 1 ? 'equipo' : 'equipos'}
            </span>
            {torneo.champion_name && (
              <span className={CHIP_SOBRE_FOTO} data-testid="tournament-champion">
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                Campeón: {torneo.champion_name}
              </span>
            )}
          </>
        )}
        acciones={puedeGestionar && fixtures.length === 0 ? (
          <Button
            shape="pill"
            onClick={generarFixture}
            disabled={accion === 'fixture' || equipos.length < 2}
            data-testid="generate-fixture-btn"
            className="h-11 bg-turf px-5 text-white hover:bg-turf-dark focus-visible:ring-white focus-visible:ring-offset-transparent"
          >
            {accion === 'fixture'
              ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              : <Play className="mr-1 h-4 w-4" />}
            Generar fixture
          </Button>
        ) : null}
      />

      <div className="mt-6 space-y-5">
        {fixtures.length === 0 && (
          <div
            className="flex items-start gap-3 rounded-2xl border border-turf/25 bg-turf/5 px-4 py-3 text-sm text-slate-700"
            data-testid="tournament-draft-hint"
          >
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-turf-accessible" aria-hidden="true" />
            <p>
              {equipos.length < 2
                ? 'Sumá al menos dos grupos para poder armar el fixture.'
                : puedeGestionar
                  ? 'Cuando estén todos los equipos, generá el fixture. Después de eso ya no se pueden sumar ni sacar equipos.'
                  : 'El organizador todavía no armó el fixture.'}
            </p>
          </div>
        )}

        {/* Equipos */}
        <Reveal from="up" className="block">
          <PanelSection
            icono={Users}
            titulo="Equipos"
            contador={equipos.length}
            descripcion="Cada equipo es un grupo, con su gente."
            tono="turf"
            testId="tournament-teams-panel"
          >
            {equipos.length === 0 ? (
              <p className="py-2 text-sm text-slate-600">Todavía no hay equipos en este torneo.</p>
            ) : (
              <ul className="space-y-2">
                {equipos.map((equipo) => (
                  <li
                    key={equipo.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                    data-testid={`tournament-team-${equipo.id}`}
                  >
                    {equipo.zone && (
                      <span
                        aria-label={`Zona ${equipo.zone}`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-turf/10 font-heading text-sm font-bold text-turf-accessible"
                      >
                        {equipo.zone}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{equipo.name}</p>
                      <p className="text-xs text-slate-600">
                        {equipo.members_count} {equipo.members_count === 1 ? 'jugador' : 'jugadores'}
                      </p>
                    </div>
                    {puedeGestionar && torneo.status === 'borrador' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        shape="pill"
                        onClick={() => sacarEquipo(equipo.id, equipo.name)}
                        disabled={accion === `team-${equipo.id}`}
                        aria-label={`Sacar ${equipo.name} del torneo`}
                        data-testid={`remove-team-${equipo.id}`}
                        className="h-10 w-10 shrink-0 p-0 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        {accion === `team-${equipo.id}`
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </PanelSection>
        </Reveal>

        {/* Tabla de posiciones */}
        {deZonaOLiga.length > 0 && (
          <Reveal from="up" delay={60} className="block">
            <PanelSection
              icono={ListOrdered}
              titulo="Tabla"
              descripcion="3 puntos por ganado, 1 por empatado. Desempata la diferencia de gol."
              tono="charcoal"
              testId="tournament-standings-panel"
            >
              {zonas.length > 0 ? (
                <div className="space-y-4">
                  {zonas.map((zona) => (
                    <div key={zona}>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                        Zona {zona}
                      </p>
                      <StandingsTable
                        filas={standings.filter((f) => f.zone === zona)}
                        clasifican={torneo.qualifiers_per_zone}
                        testId={`standings-zona-${zona}`}
                      />
                    </div>
                  ))}
                  <p className="text-xs text-slate-600">
                    La línea marca hasta dónde se clasifica a las llaves.
                  </p>
                </div>
              ) : (
                <StandingsTable filas={standings} />
              )}
            </PanelSection>
          </Reveal>
        )}

        {puedeGenerarLlaves && (
          <div
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-orange/30 bg-orange/5 px-4 py-3"
            data-testid="playoffs-cta"
          >
            <p className="min-w-0 flex-1 text-sm text-slate-700">
              Terminó la fase de zonas. Ya podés armar las llaves con los clasificados.
            </p>
            <Button
              shape="pill"
              onClick={generarLlaves}
              disabled={accion === 'playoffs'}
              data-testid="generate-playoffs-btn"
              className="h-11 bg-orange px-5 text-white hover:bg-orange/90"
            >
              {accion === 'playoffs'
                ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                : <Swords className="mr-1 h-4 w-4" />}
              Generar llaves
            </Button>
          </div>
        )}

        {/* Fixture */}
        {fixtures.length > 0 && (
          <Reveal from="up" delay={120} className="block">
            <PanelSection
              icono={CalendarDays}
              titulo="Partidos"
              contador={fixtures.length}
              descripcion={puedeGestionar
                ? 'Tocá el lápiz para cargar o corregir un resultado.'
                : 'Los resultados los carga quien organiza el torneo.'}
              tono="turf"
              sinPadding
              testId="tournament-fixtures-panel"
            >
              <GruposDeFixture
                fixtures={fixtures}
                puedeEditar={puedeGestionar}
                onGuardar={guardarResultado}
              />
            </PanelSection>
          </Reveal>
        )}

        {puedeGestionar && (
          <PanelSection
            icono={Trash2}
            titulo="Borrar torneo"
            descripcion="Se van el fixture y todos los resultados. Los grupos y sus jugadores no se tocan."
            tono="orange"
            testId="tournament-danger-zone"
          >
            <Button
              variant="outline"
              shape="pill"
              onClick={borrarTorneo}
              disabled={accion === 'delete'}
              data-testid="delete-tournament-btn"
              className="h-11 border-red-200 bg-white px-5 text-red-600 hover:bg-red-50"
            >
              {accion === 'delete'
                ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                : <Trash2 className="mr-1 h-4 w-4" />}
              Borrar este torneo
            </Button>
          </PanelSection>
        )}
      </div>
    </div>
  );
}

/**
 * Agrupa el fixture por instancia y por fecha.
 *
 * Una lista plana de 30 partidos no se puede usar: el organizador viene a
 * cargar "la fecha 3", no el partido número 17. Los encabezados de grupo son lo
 * que convierte la lista en algo navegable.
 */
function GruposDeFixture({ fixtures, puedeEditar, onGuardar }) {
  const grupos = [];
  const indice = new Map();

  fixtures.forEach((fx) => {
    const esLlave = ORDEN_LLAVES.includes(fx.stage);
    // Las llaves se agrupan por instancia (todos los cuartos juntos); la liga y
    // las zonas, por fecha adentro de su zona.
    const clave = esLlave ? fx.stage : `${fx.stage}-${fx.zone || ''}-${fx.round}`;
    const titulo = esLlave
      ? fx.stage_label
      : fx.zone
        ? `${fx.stage_label} · Fecha ${fx.round}`
        : `Fecha ${fx.round}`;

    if (!indice.has(clave)) {
      indice.set(clave, grupos.length);
      grupos.push({ clave, titulo, items: [] });
    }
    grupos[indice.get(clave)].items.push(fx);
  });

  return (
    <div>
      {grupos.map((grupo, i) => (
        <section key={grupo.clave} data-testid={`fixture-group-${grupo.clave}`}>
          <h3
            className={cn(
              'bg-slate-50/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600',
              i > 0 && 'border-t border-slate-200',
            )}
          >
            {grupo.titulo}
          </h3>
          <ul>
            {grupo.items.map((fx) => (
              <FixtureRow
                key={fx.id}
                fixture={fx}
                puedeEditar={puedeEditar}
                onGuardar={onGuardar}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
