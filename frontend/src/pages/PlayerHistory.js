import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Trophy, Star, ArrowLeft, Target, Users, Hand, Gauge, TrendingUp, CalendarX,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function ratingTier(value) {
  if (value == null) return { text: 'text-slate-400' };
  if (value >= 7) return { text: 'text-turf-accessible' };
  if (value >= 5) return { text: 'text-orange' };
  return { text: 'text-slate-500' };
}

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

  const statTiles = [
    { label: 'Partidos', value: metrics?.total_matches ?? 0, icon: Trophy },
    { label: 'Goles', value: metrics?.total_goals ?? 0, icon: Target },
    { label: 'Asistencias', value: metrics?.total_assists ?? 0, icon: Users },
    ...(metrics?.total_saves > 0 ? [{ label: 'Atajadas', value: metrics.total_saves, icon: Hand }] : []),
  ];

  if (loading) return <div className="flex justify-center py-20" data-testid="player-history-loading"><div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="page-container max-w-3xl mx-auto" data-testid="player-history-page">
      <div className="animate-slide-up">
        <Link
          to={isOwn ? '/mi-perfil' : `/jugadores/${playerId}`}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4"
          data-testid="back-to-profile-link"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al perfil
        </Link>

        <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight mb-6">Historial</h1>

        {/* Rating summary */}
        {metrics && historyMeta.can_view_peer_scores && (
          <Card className="border-slate-100 mb-3" data-testid="rating-summary-card">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className={`inline-flex items-center gap-1.5 ${ratingTier(metrics.general_rating).text}`}>
                    <Star className="w-5 h-5 fill-current" />
                    <span className="font-heading text-3xl font-bold">{metrics.general_rating?.toFixed(1)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider mt-1">Rating General</p>
                </div>
                <div className="text-center border-l border-slate-100">
                  <div className={`inline-flex items-center gap-1.5 ${ratingTier(metrics.recent_rating).text}`}>
                    <Star className="w-5 h-5 fill-current" />
                    <span className="font-heading text-3xl font-bold">{metrics.recent_rating?.toFixed(1)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider mt-1">Rating Reciente</p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5" /> Confianza del rating
                  </span>
                  <span className="text-xs font-bold text-slate-700" data-testid="confidence-index-value">{confidence.pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${confidence.bar}`} style={{ width: `${confidence.pct}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{confidence.msg}</p>

                {metrics.stats_bonus > 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-orange bg-orange/10 rounded-full px-3 py-1.5 w-fit mt-3" data-testid="stats-bonus-chip">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Bono de +{metrics.stats_bonus.toFixed(1)} por tu buen rendimiento reciente
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metrics Summary */}
        {metrics && (
          <>
            <div className={`grid grid-cols-2 sm:grid-cols-3 ${statTiles.length >= 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3 mb-3`} data-testid="stat-tiles">
              {statTiles.map((s, i) => (
                <Card key={i} className="border-slate-100">
                  <CardContent className="p-4 text-center">
                    <s.icon className="w-4 h-4 mx-auto mb-1.5 text-turf-accessible" />
                    <p className="text-xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {!historyMeta.can_view_peer_scores && (
              <Card className="border-slate-100 mb-8 bg-slate-50">
                <CardContent className="p-4 text-sm text-slate-600">
                  Los puntajes internos y ratings derivados quedan visibles solo para organizadores y admins.
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Rating Evolution Chart */}
        {historyMeta.can_view_peer_scores && chartData.length >= 2 && (
          <Card className="border-slate-100 mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase">Evolución de Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64" data-testid="rating-evolution-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="fecha"
                      tickFormatter={formatShortDate}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      minTickGap={24}
                      angle={-20}
                      textAnchor="end"
                      height={35}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickCount={6}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                      formatter={(value) => [`${value.toFixed(1)}`, 'Rating']}
                      labelFormatter={(label) => `Partido: ${formatFullDate(label)}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="rating"
                      stroke="#00C853"
                      strokeWidth={3}
                      dot={{ fill: '#00C853', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, fill: '#FF6B00' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                Basado en tus últimos {chartData.length} partidos calificados.
              </p>
            </CardContent>
          </Card>
        )}

        {historyMeta.can_view_peer_scores && chartData.length === 1 && (
          <Card className="border-dashed border-2 border-slate-200 mb-8 bg-slate-50/50">
            <CardContent className="p-6 text-center">
              <p className="text-sm font-semibold text-slate-700">Ya tenés tu primer partido calificado</p>
              <p className="text-sm text-slate-500 mt-1">Necesitás al menos 1 partido calificado más para ver tu gráfico de evolución.</p>
            </CardContent>
          </Card>
        )}

        {historyMeta.can_view_peer_scores && chartData.length === 0 && (
          <Card className="border-dashed border-2 border-slate-200 mb-8 bg-slate-50/50" data-testid="rating-evolution-empty">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Todavía no tenés partidos calificados</p>
              <p className="text-sm text-slate-500 mt-1">
                {isOwn ? 'Jugá tu próximo partido para empezar a ver tu evolución de rating acá.' : 'Este jugador todavía no tiene partidos calificados.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Position Ratings */}
        {historyMeta.can_view_peer_scores && metrics?.position_ratings && Object.keys(metrics.position_ratings).length > 0 && (
          <Card className="border-slate-100 mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase">Rating por Posición</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 -mt-2 mb-3">Tu rating promedio en cada posición jugada.</p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(metrics.position_ratings).map(([pos, rating]) => (
                  <div key={pos} className="bg-slate-50 rounded-lg px-4 py-2 text-center" data-testid={`position-rating-${pos}`}>
                    <p className={`text-sm font-bold ${ratingTier(rating).text}`}>{rating.toFixed(1)}</p>
                    <p className="text-xs text-slate-500">{posMap[pos] || pos}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Match History */}
        <Card className="border-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg uppercase">Partidos Jugados</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 && (
              <div className="text-center py-10" data-testid="history-empty-state">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <CalendarX className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No hay partidos en el historial todavía</p>
                {isOwn && (
                  <Link to="/partidos" className="text-sm text-turf-accessible font-semibold hover:underline mt-1 inline-block">
                    Buscar un partido para jugar
                  </Link>
                )}
              </div>
            )}
            <div className="space-y-3">
              {history.map((h, i) => (
                <Link to={`/partidos/${h.match_id}`} key={i} className="block" data-testid={`history-match-${h.match_id}`}>
                  <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-3 px-3 rounded-lg transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{h.match_title}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                          <span>{formatFullDate(h.match_date)}</span>
                          {h.position_played && <Badge variant="outline" className="text-[10px] py-0">{posMap[h.position_played] || h.position_played}</Badge>}
                          {h.team && <Badge variant="outline" className="text-[10px] py-0">Equipo {h.team}</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      {historyMeta.can_view_peer_scores && h.avg_rating && (
                        <div className="flex items-center gap-1 justify-end">
                          <Star className="w-3.5 h-3.5 text-turf-accessible fill-current" />
                          <span className="text-sm font-bold text-turf-accessible">{h.avg_rating}</span>
                        </div>
                      )}
                      {!historyMeta.can_view_peer_scores && h.self_evaluation?.score != null && (
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-xs font-semibold text-slate-500">Auto</span>
                          <span className="text-sm font-bold text-slate-700">{h.self_evaluation.score}</span>
                        </div>
                      )}
                      {h.stats && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {h.stats.goals > 0 && `G:${h.stats.goals} `}
                          {h.stats.assists > 0 && `A:${h.stats.assists} `}
                          {h.stats.saves > 0 && `At:${h.stats.saves}`}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
