import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Camera, Star, Trophy, Edit3, Save, X, History } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PlayerProfile({ isSelf }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [positions, setPositions] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);

  const playerId = isSelf ? (user?.profile_id || user?.profile?.id) : id;
  const isOwn = isSelf || playerId === (user?.profile_id || user?.profile?.id);

  useEffect(() => {
    const load = async () => {
      try {
        const [profileRes, metricsRes, posRes] = await Promise.all([
          isOwn ? api.get('/profile') : api.get(`/players/${playerId}`),
          api.get(`/players/${playerId}/metrics`).catch(() => ({ data: null })),
          api.get('/positions'),
        ]);
        setProfile(profileRes.data);
        setMetrics(metricsRes.data);
        setPositions(posRes.data || []);
        setEditForm({
          name: profileRes.data.name,
          birth_date: profileRes.data.birth_date || '',
          primary_position: profileRes.data.primary_position || '',
          secondary_positions: profileRes.data.secondary_positions || [],
          unwanted_position: profileRes.data.unwanted_position || '',
        });
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [playerId, isOwn]);

  const handleSave = async () => {
    try {
      await api.put('/profile', editForm);
      toast.success('Perfil actualizado');
      setEditing(false);
      const res = isOwn ? await api.get('/profile') : await api.get(`/players/${playerId}`);
      setProfile(res.data);
    } catch (err) { toast.error('Error al actualizar'); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/profile/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile(prev => ({ ...prev, photo_url: res.data.photo_url }));
      toast.success('Foto actualizada');
    } catch (err) { toast.error('Error al subir foto'); }
  };

  const posMap = {};
  positions.forEach(p => { posMap[p.id] = p.name; });

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" /></div>;
  if (!profile) return <div className="page-container text-center text-slate-500">Jugador no encontrado</div>;

  const photoUrl = profile.photo_url ? (profile.photo_url.startsWith('http') ? profile.photo_url : `${API_URL}${profile.photo_url}`) : null;

  return (
    <div className="page-container max-w-2xl mx-auto" data-testid="player-profile-page">
      <div className="animate-slide-up">
        {/* Header Card */}
        <Card className="border-slate-100 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-turf to-turf-dark h-24 relative" />
          <CardContent className="relative px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-12">
              <div className="relative">
                <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                  <AvatarImage src={photoUrl} />
                  <AvatarFallback className="bg-slate-200 text-slate-600 text-2xl font-bold">
                    {profile.name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isOwn && (
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-turf rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-turf-dark transition-colors">
                    <Camera className="w-4 h-4 text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} data-testid="photo-upload-input" />
                  </label>
                )}
              </div>
              <div className="text-center sm:text-left flex-1">
                <h1 className="font-heading text-2xl md:text-3xl font-bold uppercase tracking-tight">{profile.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1 justify-center sm:justify-start">
                  <Badge className="bg-turf/10 text-turf border-turf/20 text-xs">
                    {profile.player_type === 'frecuente' ? 'Jugador Frecuente' : 'Invitado'}
                  </Badge>
                  {profile.age && <span className="text-sm text-slate-500">{profile.age} anios</span>}
                </div>
              </div>
              {isOwn && (
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <Button size="sm" onClick={handleSave} className="bg-turf text-white rounded-full" data-testid="save-edit-btn">
                        <Save className="w-4 h-4 mr-1" /> Guardar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="rounded-full" data-testid="cancel-edit-btn">
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="rounded-full" data-testid="edit-profile-btn">
                      <Edit3 className="w-4 h-4 mr-1" /> Editar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        {editing && (
          <Card className="border-slate-100 mb-6">
            <CardContent className="p-5 space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="mt-1 h-12 bg-slate-50" data-testid="edit-name" />
              </div>
              <div>
                <Label>Fecha de nacimiento</Label>
                <Input type="date" value={editForm.birth_date} onChange={e => setEditForm(p => ({ ...p, birth_date: e.target.value }))} className="mt-1 h-12 bg-slate-50" data-testid="edit-birthdate" />
              </div>
              <div>
                <Label>Posicion principal</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {positions.map(p => (
                    <Badge key={p.id} variant={editForm.primary_position === p.id ? 'default' : 'outline'} className={`cursor-pointer ${editForm.primary_position === p.id ? 'bg-turf text-white border-turf' : ''}`}
                      onClick={() => setEditForm(prev => ({ ...prev, primary_position: p.id }))}>{p.name}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Rating General', value: metrics.general_rating?.toFixed(1), icon: Star },
              { label: 'Rating Reciente', value: metrics.recent_rating?.toFixed(1), icon: Star },
              { label: 'Partidos', value: metrics.total_matches, icon: Trophy },
              { label: 'Confianza', value: `${(metrics.confidence_index * 100).toFixed(0)}%`, icon: Trophy },
            ].map((s, i) => (
              <Card key={i} className="border-slate-100">
                <CardContent className="p-4 text-center">
                  <p className="text-xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Positions */}
        <Card className="border-slate-100 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg uppercase">Posiciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Principal</span>
                <div className="mt-1">
                  {profile.primary_position ? (
                    <Badge className="bg-turf text-white">{posMap[profile.primary_position] || profile.primary_position}</Badge>
                  ) : <span className="text-sm text-slate-400">Sin definir</span>}
                </div>
              </div>
              {profile.secondary_positions?.length > 0 && (
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Secundarias</span>
                  <div className="mt-1 flex gap-2">{profile.secondary_positions.map(p => (
                    <Badge key={p} variant="outline">{posMap[p] || p}</Badge>
                  ))}</div>
                </div>
              )}
              {profile.unwanted_position && (
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider">No deseada</span>
                  <div className="mt-1"><Badge variant="destructive">{posMap[profile.unwanted_position] || profile.unwanted_position}</Badge></div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* History Link */}
        <Link to={isOwn ? `/jugadores/${playerId}/historial` : `/jugadores/${playerId}/historial`}>
          <Button variant="outline" className="w-full rounded-xl h-12" data-testid="view-history-btn">
            <History className="w-4 h-4 mr-2" /> Ver Historial Completo
          </Button>
        </Link>
      </div>
    </div>
  );
}
