import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Trophy, Star, ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PlayerHistory() {
  const { id } = useParams();
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const playerId = id || user?.profile_id || user?.profile?.id;

  useEffect(() => {
    const load = async () => {
      try {
        const [histRes, metRes] = await Promise.all([
          api.get(`/players/${playerId}/history`),
          api.get(`/players/${playerId}/metrics`),
        ]);
        setHistory(histRes.data || []);
        setMetrics(metRes.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [playerId]);

  // Prepare chart data (oldest to newest)
  const chartData = [...history]
    .filter(h => h.avg_rating != null)
    .reverse()
    .map(h => ({
      fecha: h.match_date,
      rating: h.avg_rating,
      titulo: h.match_title,
    }));

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="page-container max-w-3xl mx-auto" data-testid="player-history-page">
      <div className="animate-slide-up">
        <Link to="/mi-perfil" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver al perfil
        </Link>

        <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight mb-6">Historial</h1>

        {/* Metrics Summary */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Card className="border-slate-100">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-turf">{metrics.total_matches}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Partidos</p>
              </CardContent>
            </Card>
            <Card className="border-slate-100">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{metrics.recent_rating?.toFixed(1)}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Rating Reciente</p>
              </CardContent>
            </Card>
            <Card className="border-slate-100">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{metrics.total_goals}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Goles</p>
              </CardContent>
            </Card>
            <Card className="border-slate-100">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{metrics.total_assists}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Asistencias</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Rating Evolution Chart */}
        {chartData.length >= 2 && (
          <Card className="border-slate-100 mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase">Evolucion de Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64" data-testid="rating-evolution-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      angle={-30}
                      textAnchor="end"
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickCount={6}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                      formatter={(value, name) => [`${value.toFixed(1)}`, 'Rating']}
                      labelFormatter={(label) => `Partido: ${label}`}
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
            </CardContent>
          </Card>
        )}

        {chartData.length === 1 && (
          <Card className="border-slate-100 mb-8 bg-slate-50">
            <CardContent className="p-6 text-center text-sm text-slate-500">
              Se necesitan al menos 2 partidos con evaluaciones para ver la evolucion de rating.
            </CardContent>
          </Card>
        )}

        {/* Position Ratings */}
        {metrics?.position_ratings && Object.keys(metrics.position_ratings).length > 0 && (
          <Card className="border-slate-100 mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase">Rating por Posicion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {Object.entries(metrics.position_ratings).map(([pos, rating]) => (
                  <div key={pos} className="bg-slate-50 rounded-lg px-4 py-2 text-center">
                    <p className="text-sm font-bold text-slate-900">{rating.toFixed(1)}</p>
                    <p className="text-xs text-slate-500">{pos}</p>
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
              <p className="text-sm text-slate-400 text-center py-8">No hay partidos en el historial</p>
            )}
            <div className="space-y-3">
              {history.map((h, i) => (
                <Link to={`/partidos/${h.match_id}`} key={i} className="block" data-testid={`history-match-${h.match_id}`}>
                  <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-3 px-3 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{h.match_title}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{h.match_date}</span>
                          {h.position_played && <Badge variant="outline" className="text-[10px] py-0">{h.position_played}</Badge>}
                          {h.team && <Badge variant="outline" className="text-[10px] py-0">Equipo {h.team}</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {h.avg_rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-turf" />
                          <span className="text-sm font-bold text-turf">{h.avg_rating}</span>
                        </div>
                      )}
                      {h.stats && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {h.stats.goals > 0 && `G:${h.stats.goals} `}
                          {h.stats.assists > 0 && `A:${h.stats.assists} `}
                          {h.stats.saves > 0 && `S:${h.stats.saves}`}
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
