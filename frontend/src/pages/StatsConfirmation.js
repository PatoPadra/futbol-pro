import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, CheckCircle, Clock, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';

export default function StatsConfirmation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [finalStats, setFinalStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [propRes, finalRes] = await Promise.all([
        api.get(`/matches/${id}/stats/proposals`),
        api.get(`/matches/${id}/stats/final`),
      ]);
      setProposals(propRes.data || []);
      setFinalStats(finalRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [id]);

  const handleVote = async (proposalId) => {
    try {
      const res = await api.post(`/matches/${id}/stats/vote`, { proposal_id: proposalId });
      toast.success(res.data.message);
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error al votar'); }
  };

  const confirmedPlayerIds = new Set(finalStats.map(s => s.player_id));

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="page-container max-w-3xl mx-auto" data-testid="stats-confirmation-page">
      <div className="animate-slide-up">
        <button onClick={() => navigate(`/partidos/${id}/post-partido`)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mb-2">Confirmacion de Estadisticas</h1>
        <p className="text-slate-500 mb-6">Las estadisticas se confirman cuando la mitad de los jugadores votan a favor.</p>

        {/* Confirmed Stats */}
        {finalStats.length > 0 && (
          <Card className="border-turf/20 bg-turf/5 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase flex items-center gap-2 text-turf">
                <CheckCircle className="w-5 h-5" /> Estadisticas Confirmadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {finalStats.map(s => (
                  <div key={s.player_id} className="bg-white rounded-lg p-3 border border-turf/10" data-testid={`confirmed-stat-${s.player_id}`}>
                    <p className="font-medium text-sm text-slate-900">{s.player_name}</p>
                    <div className="flex gap-4 mt-1 text-xs text-slate-600">
                      {s.goals > 0 && <span>G: {s.goals}</span>}
                      {s.assists > 0 && <span>A: {s.assists}</span>}
                      {s.saves > 0 && <span>S: {s.saves}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Proposals */}
        <Card className="border-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange" /> Propuestas Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {proposals.filter(p => !confirmedPlayerIds.has(p.player_id)).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No hay propuestas pendientes</p>
            )}
            {proposals.filter(p => !confirmedPlayerIds.has(p.player_id)).map(p => (
              <div key={p.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0" data-testid={`proposal-${p.id}`}>
                <div>
                  <p className="font-medium text-sm">{p.player_name}</p>
                  <div className="flex gap-3 mt-1 text-xs text-slate-500">
                    {p.goals > 0 && <span>Goles: {p.goals}</span>}
                    {p.assists > 0 && <span>Asistencias: {p.assists}</span>}
                    {p.saves > 0 && <span>Salvadas: {p.saves}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Votos: {p.votes?.length || 0}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => handleVote(p.id)}
                  data-testid={`vote-proposal-${p.id}`}
                >
                  <ThumbsUp className="w-3.5 h-3.5 mr-1" /> Confirmar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
