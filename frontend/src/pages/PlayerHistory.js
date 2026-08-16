import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Trophy, TrendingUp, TrendingDown, CalendarX, LineChart, Compass, Info, CalendarDays,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getRatingTone } from '@/utils/ratings';
import PageLoader from '@/components/common/PageLoader';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import Reveal from '@/components/common/Reveal';
import MetricTiles from '@/components/players/MetricTiles';
import RatingPanel from '@/components/players/RatingPanel';
import MatchTimeline from '@/components/players/MatchTimeline';

// Mirrors tailwind.config.js turf/orange — Recharts needs real color values,
// not Tailwind classes, so this is the one place those tokens get duplicated.
const CHART_COLORS = {
  turf: '#00C853',
  turfDark: '#009624',
  orange: '#FF6B00',
  grid: '#e2e8f0',
  axisText: '#64748b',
};

function confidenceMeta(index) {
  const pct = Math.round((index || 0) * 100);
  if (pct >= 70) {
    return { pct, bar: 'bg-turf', msg: 'Rating confiable: está basado en varios partidos evaluados.' };
  }
  if (pct >= 30) {
    return { pct, bar: 'bg-orange', msg: 'Tu rating se va afinando con cada partido que jugás.' };
  }
  return { pct, bar: 'bg-slate-300', msg: 'Recién estamos conociendo tu nivel. ¡Jugá más partidos para afinarlo!' };
}

// Parsed manually (not via `new Date()`) so a date-only string like "2026-01-15"
// never shifts a day backward/forward under non-UTC timezones (e.g. UTC-3 in Argentina).
function parseDateParts(dateStr) {
  if (!dateStr) return null;
  const datePart = String(dateStr).split('T')[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return null;
  return { year: match[1], month: match[2], day: match[3] };
}

function formatShortDate(dateStr) {
  const parts = parseDateParts(dateStr);
  return parts ? `${parts.day}/${parts.month}` : (dateStr || '');
}

function formatFullDate(dateStr) {
  const parts = parseDateParts(dateStr);
  return parts ? `${parts.day}/${parts.month}/${parts.year}` : (dateStr || '');
}

/** Encabezado de sección: ícono en chip + título, el mismo patrón que el panel. */
function SeccionTitulo({ icono: Icono, titulo, ayuda }) {
  return (
    <div className="mb-3">
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold uppercase tracking-tight text-slate-900">
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-turf/10 text-turf-accessible"
        >
          <Icono className="h-4 w-4" />
        </span>
        {titulo}
      </h2>
      {ayuda && <p className="mt-1.5 text-xs text-slate-500">{ayuda}</p>}
    </div>
  );
}

export default function PlayerHistory() {
  const { id } = useParams();
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [positions, setPositions] = useState([]);
  const [historyMeta, setHistoryMeta] = useState({ can_view_peer_scores: false, can_view_self_scores: false, score_visibility_scope: 'restricted' });
  const [loading, setLoading] = useState(true);

  const playerId = id || user?.profile_id || user?.profile?.id;
  const ownProfileId = user?.profile_id || user?.profile?.id;
  const isOwn = playerId === ownProfileId;

  useEffect(() => {
    const load = async () => {
      try {
        const [histRes, metRes, posRes] = await Promise.all([
          api.get(`/players/${playerId}/history`),
          api.get(`/players/${playerId}/metrics`),
          api.get('/positions').catch(() => ({ data: [] })),
        ]);
        setHistory(histRes.data?.history || []);
        setHistoryMeta({
          can_view_peer_scores: Boolean(histRes.data?.can_view_peer_scores),
          can_view_self_scores: Boolean(histRes.data?.can_view_self_scores),
          score_visibility_scope: histRes.data?.score_visibility_scope || 'restricted',
        });
        setMetrics(metRes.data);
        setPositions(posRes.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [playerId]);

  const posMap = {};
  positions.forEach(p => { posMap[p.id] = p.name; });

  // Prepare chart data (oldest to newest)
  const chartData = [...history]
    .filter(h => historyMeta.can_view_peer_scores && h.avg_rating != null)
    .reverse()
    .map(h => ({
      fecha: h.match_date,
      rating: h.avg_rating,
      titulo: h.match_title,
    }));

  const confidence = metrics ? confidenceMeta(metrics.confidence_index) : null;

  const ratingDelta = chartData.length >= 2
    ? chartData[chartData.length - 1].rating - chartData[chartData.length - 2].rating
    : null;

  const statTiles = [
    { label: 'Partidos', value: metrics?.total_matches ?? 0 },
    { label: 'Goles', value: metrics?.total_goals ?? 0 },
    { label: 'Asistencias', value: metrics?.total_assists ?? 0 },
    ...(metrics?.total_saves > 0 ? [{ label: 'Atajadas', value: metrics.total_saves }] : []),
  ];

  if (loading) return <div data-testid="player-history-loading"><PageLoader /></div>;

  return (
    <div className="page-container mx-auto max-w-3xl" data-testid="player-history-page">
      <PageHeader
        slug="historial"
        priority
        // El volver va adentro de la banda como en las otras 11 paginas. Antes
        // era un Link propio encima del encabezado, en gris sobre fondo claro:
        // saltaba de lugar y de color al navegar entre perfil e historial.
        volverA={isOwn ? '/mi-perfil' : `/jugadores/${playerId}`}
        volverLabel="Volver al perfil"
        volverTestId="back-to-profile-link"
        icono={CalendarDays}
        eyebrow={isOwn ? 'Todo lo que jugaste' : 'Todo lo que jugó'}
        titulo="Historial"
        bajada={
          history.length > 0
            ? `${history.length} ${history.length === 1 ? 'partido' : 'partidos'} en la cuenta, del más reciente al primero.`
            : 'Acá se va a ir armando la línea de tiempo, partido por partido.'
        }
        testId="player-history-header"
      />

      {/* Rating */}
      {metrics && historyMeta.can_view_peer_scores && (
        <Reveal from="up" delay={40} className="mt-6 block">
          <RatingPanel metrics={metrics} confidence={confidence} testId="rating-summary-card" />
        </Reveal>
      )}

      {/* Métricas */}
      {metrics && (
        <>
          <Reveal from="up" delay={70} className="mt-4 block">
            <MetricTiles tiles={statTiles} testId="stat-tiles" />
          </Reveal>
          {!historyMeta.can_view_peer_scores && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <p>Los puntajes internos y ratings derivados quedan visibles solo para organizadores y admins.</p>
            </div>
          )}
        </>
      )}

      {/* Evolución del rating */}
      {historyMeta.can_view_peer_scores && chartData.length >= 2 && (
        <Reveal as="section" from="up" delay={90} className="mt-8 block">
          <SeccionTitulo
            icono={LineChart}
            titulo="Evolución del rating"
            ayuda={`Basado en tus últimos ${chartData.length} partidos calificados.`}
          />
          <Card className="rounded-3xl border-slate-100 shadow-lift">
            <CardContent className="p-4 md:p-5">
              {ratingDelta != null && Math.abs(ratingDelta) >= 0.05 && (
                <div
                  className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${getRatingTone(chartData[chartData.length - 1].rating).bg} ${ratingDelta >= 0 ? 'text-turf-accessible' : 'text-rose-600'}`}
                  data-testid="rating-trend-delta"
                >
                  {ratingDelta >= 0 ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
                  {ratingDelta >= 0 ? '+' : ''}{ratingDelta.toFixed(1)} desde el partido anterior
                </div>
              )}
              <div className="h-64 md:h-80" data-testid="rating-evolution-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 10, left: 0 }}>
                    <defs>
                      <linearGradient id="ratingAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.turf} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={CHART_COLORS.turf} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="2 6"
                      stroke={CHART_COLORS.grid}
                    />
                    <XAxis
                      dataKey="fecha"
                      tickFormatter={formatShortDate}
                      tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
                      tickLine={false}
                      axisLine={{ stroke: CHART_COLORS.grid }}
                      minTickGap={24}
                      angle={-20}
                      textAnchor="end"
                      height={35}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
                      tickLine={false}
                      axisLine={false}
                      tickCount={6}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: `1px solid ${CHART_COLORS.grid}`,
                        borderRadius: '12px',
                        boxShadow: '0 12px 28px -8px rgba(15, 23, 42, 0.18)',
                        fontSize: '13px',
                      }}
                      formatter={(value) => [`${value.toFixed(1)}`, 'Rating']}
                      labelFormatter={(label) => `Partido: ${formatFullDate(label)}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="rating"
                      stroke={CHART_COLORS.turfDark}
                      strokeWidth={3}
                      fill="url(#ratingAreaFill)"
                      dot={{ fill: '#fff', stroke: CHART_COLORS.turfDark, strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 7, fill: CHART_COLORS.orange, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </Reveal>
      )}

      {historyMeta.can_view_peer_scores && chartData.length === 1 && (
        <Card className="mt-8 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/60">
          <CardContent className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-700">Ya tenés tu primer partido calificado</p>
            <p className="mt-1 text-sm text-slate-600">Necesitás al menos 1 partido calificado más para ver tu gráfico de evolución.</p>
          </CardContent>
        </Card>
      )}

      {historyMeta.can_view_peer_scores && chartData.length === 0 && (
        <Card className="mt-8 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/60" data-testid="rating-evolution-empty">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <TrendingUp className="h-5 w-5 text-slate-500" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Todavía no tenés partidos calificados</p>
            <p className="mt-1 text-sm text-slate-600">
              {isOwn ? 'Jugá tu próximo partido para empezar a ver tu evolución de rating acá.' : 'Este jugador todavía no tiene partidos calificados.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rating por posición */}
      {historyMeta.can_view_peer_scores && metrics?.position_ratings && Object.keys(metrics.position_ratings).length > 0 && (
        <Reveal as="section" from="up" delay={60} className="mt-8 block">
          <SeccionTitulo
            icono={Compass}
            titulo="Rating por posición"
            ayuda="Tu rating promedio en cada posición jugada."
          />
          <div className="flex flex-wrap gap-3">
            {Object.entries(metrics.position_ratings).map(([pos, rating]) => {
              const tone = getRatingTone(rating);
              return (
                <div
                  key={pos}
                  className={`min-w-[112px] rounded-2xl border bg-white p-3 text-center shadow-sm ${tone.border}`}
                  data-testid={`position-rating-${pos}`}
                >
                  <p className={`font-heading text-2xl font-bold leading-none tabular-nums ${tone.text}`}>
                    {rating.toFixed(1)}
                  </p>
                  <p className="mt-1.5 text-xs font-semibold text-slate-600">{posMap[pos] || pos}</p>
                  <span className={`mt-2 inline-block h-1.5 w-10 rounded-full ${tone.solid}`} aria-hidden="true" />
                </div>
              );
            })}
          </div>
        </Reveal>
      )}

      {/* Línea de tiempo */}
      <section className="mt-8">
        <SeccionTitulo icono={Trophy} titulo="Partidos jugados" />

        {history.length === 0 ? (
          <EmptyState
            variante={2}
            icono={CalendarX}
            titulo="No hay partidos en el historial todavía"
            descripcion={isOwn
              ? 'Cuando juegues tu primer partido va a aparecer acá, con tu posición y tus números.'
              : 'Este jugador todavía no tiene partidos jugados.'}
            testId="history-empty-state"
            accion={isOwn ? (
              <Link to="/partidos">
                <Button
                  shape="pill"
                  className="h-11 bg-turf px-6 text-white hover:bg-turf-dark focus-visible:ring-white focus-visible:ring-offset-transparent"
                >
                  Buscar un partido
                </Button>
              </Link>
            ) : null}
          />
        ) : (
          <MatchTimeline
            history={history}
            posMap={posMap}
            canViewPeerScores={historyMeta.can_view_peer_scores}
          />
        )}
      </section>
    </div>
  );
}
