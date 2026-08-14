import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import PhotoLightbox from '../components/common/PhotoLightbox';
import {
  Camera, Star, Trophy, Edit3, Save, X, History,
  Gauge, TrendingUp, Target, Users, Hand, UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';
import { getRatingTone } from '@/utils/ratings';
import StatTile from '@/components/common/StatTile';
import PageLoader from '@/components/common/PageLoader';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const profileFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  birth_date: z.string().optional().or(z.literal('')),
  primary_position: z.string().optional().or(z.literal('')),
  secondary_positions: z.array(z.string()).optional(),
  unwanted_position: z.string().optional().or(z.literal('')),
});

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

export default function PlayerProfile({ isSelf }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [positions, setPositions] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);

  const playerId = isSelf ? (user?.profile_id || user?.profile?.id) : id;
  const isOwn = isSelf || playerId === (user?.profile_id || user?.profile?.id);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      birth_date: '',
      primary_position: '',
      secondary_positions: [],
      unwanted_position: '',
    },
  });

  const editForm = watch();

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
        reset({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, isOwn]);

  const handleSave = handleSubmit(async (values) => {
    try {
      await api.put('/profile', values);
      toast.success('Perfil actualizado');
      setEditing(false);
      const res = isOwn ? await api.get('/profile') : await api.get(`/players/${playerId}`);
      setProfile(res.data);
    } catch (err) { toast.error('Error al actualizar el perfil'); }
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error('La imagen no puede pesar más de 5 MB');
      return;
    }

    const fd = new FormData();
    fd.append('file', file);
    setUploadingPhoto(true);
    try {
      const res = await api.post('/profile/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile(prev => ({ ...prev, photo_url: res.data.photo_url }));
      toast.success('Foto actualizada');
    } catch (err) {
      toast.error('No se pudo subir la foto. Probá de nuevo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const toggleSecondaryPosition = (posId) => {
    const current = editForm.secondary_positions || [];
    if (current.includes(posId)) {
      setValue('secondary_positions', current.filter(p => p !== posId), { shouldDirty: true });
      return;
    }
    if (current.length >= 3) {
      toast.error('Podés elegir hasta 3 posiciones secundarias');
      return;
    }
    setValue('secondary_positions', [...current, posId], { shouldDirty: true });
    if (editForm.unwanted_position === posId) {
      setValue('unwanted_position', '', { shouldDirty: true });
    }
  };

  const toggleUnwantedPosition = (posId) => {
    setValue('unwanted_position', editForm.unwanted_position === posId ? '' : posId, { shouldDirty: true });
  };

  const posMap = {};
  positions.forEach(p => { posMap[p.id] = p.name; });

  if (loading) {
    return <div data-testid="player-profile-loading"><PageLoader /></div>;
  }

  if (!profile) {
    return (
      <div className="page-container max-w-md mx-auto text-center py-16" data-testid="player-profile-not-found">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <UserX className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="font-heading text-xl font-bold uppercase text-slate-700">Jugador no encontrado</h2>
        <p className="text-sm text-slate-500 mt-2">Puede que el perfil no exista o que no tengas acceso a él.</p>
        <Button variant="outline" className="mt-6 rounded-full h-11" onClick={() => navigate(-1)} data-testid="profile-not-found-back-btn">
          Volver
        </Button>
      </div>
    );
  }

  const photoUrl = buildPhotoUrl(profile.photo_url);
  const canViewPeerScores = Boolean(metrics?.can_view_peer_scores);
  const confidence = metrics ? confidenceMeta(metrics.confidence_index) : null;
  const secondaryOptions = positions.filter(p => p.id !== editForm.primary_position);
  const unwantedOptions = positions.filter(p => p.id !== editForm.primary_position && !(editForm.secondary_positions || []).includes(p.id));

  const statTiles = [
    { label: 'Partidos', value: metrics?.total_matches ?? 0, icon: Trophy },
    { label: 'Goles', value: metrics?.total_goals ?? 0, icon: Target },
    { label: 'Asistencias', value: metrics?.total_assists ?? 0, icon: Users },
    ...(metrics?.total_saves > 0 ? [{ label: 'Atajadas', value: metrics.total_saves, icon: Hand }] : []),
  ];

  return (
    <div className="page-container max-w-2xl mx-auto" data-testid="player-profile-page">
      <div className="animate-slide-up">
        {/* Header Card */}
        <Card className="border-slate-100 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-turf to-turf-dark h-24 relative" />
          <CardContent className="relative px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-12">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPhotoLightboxOpen(true)}
                  className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                  aria-label="Ver foto de perfil en grande"
                  data-testid="view-profile-photo-btn"
                >
                  <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                    <AvatarImage src={photoUrl} />
                    <AvatarFallback className="bg-turf/10 text-turf-accessible text-2xl font-bold font-heading">
                      {initialsFromName(profile.name)}
                    </AvatarFallback>
                  </Avatar>
                </button>
                {uploadingPhoto && (
                  <div className="absolute inset-0 rounded-full bg-slate-900/50 flex items-center justify-center pointer-events-none">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {isOwn && (
                  <label
                    className="absolute -bottom-1 -right-1 w-11 h-11 flex items-center justify-center cursor-pointer"
                    aria-label="Cambiar foto de perfil"
                    data-testid="photo-upload-label"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only peer"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      data-testid="photo-upload-input"
                    />
                    <span className="w-8 h-8 bg-turf rounded-full flex items-center justify-center shadow-md hover:bg-turf-dark transition-colors pointer-events-none peer-focus-visible:ring-2 peer-focus-visible:ring-turf peer-focus-visible:ring-offset-2">
                      <Camera className="w-4 h-4 text-white" />
                    </span>
                  </label>
                )}
              </div>
              <div className="text-center sm:text-left flex-1">
                <h1 className="font-heading text-2xl md:text-3xl font-bold uppercase tracking-tight">{profile.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1 justify-center sm:justify-start">
                  <Badge className="bg-turf/10 text-turf-accessible border-turf/20 text-xs">
                    {profile.player_type === 'frecuente' ? 'Jugador Frecuente' : 'Invitado'}
                  </Badge>
                  {profile.age && <span className="text-sm text-slate-500">{profile.age} años</span>}
                </div>
              </div>
              {isOwn && (
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <Button size="sm" onClick={handleSave} className="bg-turf hover:bg-turf-dark text-white rounded-full h-11 px-5 text-sm" data-testid="save-edit-btn">
                        <Save className="w-4 h-4 mr-1" /> Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(false)}
                        className="rounded-full h-11 w-11 p-0"
                        aria-label="Cancelar edición"
                        data-testid="cancel-edit-btn"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="rounded-full h-11 px-5 text-sm" data-testid="edit-profile-btn">
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
            <CardContent className="p-5 space-y-5">
              <div>
                <Label htmlFor="edit-name">Nombre</Label>
                <Input id="edit-name" className="mt-1 h-12 bg-slate-50" data-testid="edit-name" {...register('name')} />
                {errors.name && (
                  <p className="mt-1 text-xs text-destructive" data-testid="edit-name-error">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-birthdate">Fecha de nacimiento</Label>
                <Input id="edit-birthdate" type="date" className="mt-1 h-12 bg-slate-50" data-testid="edit-birthdate" {...register('birth_date')} />
                {errors.birth_date && (
                  <p className="mt-1 text-xs text-destructive" data-testid="edit-birthdate-error">{errors.birth_date.message}</p>
                )}
              </div>
              <div>
                <Label>Posición principal</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {positions.map(p => (
                    <Badge
                      key={p.id}
                      data-testid={`edit-primary-pos-${p.id}`}
                      variant={editForm.primary_position === p.id ? 'default' : 'outline'}
                      className={`cursor-pointer min-h-[44px] flex items-center px-4 text-sm ${editForm.primary_position === p.id ? 'bg-turf text-white border-turf' : ''}`}
                      onClick={() => {
                        setValue('primary_position', p.id, { shouldDirty: true });
                        setValue('secondary_positions', (editForm.secondary_positions || []).filter(id => id !== p.id), { shouldDirty: true });
                        if (editForm.unwanted_position === p.id) {
                          setValue('unwanted_position', '', { shouldDirty: true });
                        }
                      }}
                    >
                      {p.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Posiciones secundarias</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {secondaryOptions.map(p => {
                    const selected = (editForm.secondary_positions || []).includes(p.id);
                    return (
                      <Badge
                        key={p.id}
                        data-testid={`edit-secondary-pos-${p.id}`}
                        variant={selected ? 'default' : 'outline'}
                        className={`cursor-pointer min-h-[44px] flex items-center px-4 text-sm ${selected ? 'bg-turf text-white border-turf' : ''}`}
                        onClick={() => toggleSecondaryPosition(p.id)}
                      >
                        {p.name}
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Elegí hasta 3 posiciones donde también te sentís cómodo jugando.</p>
              </div>
              <div>
                <Label>Posición que preferís evitar</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {unwantedOptions.map(p => (
                    <Badge
                      key={p.id}
                      data-testid={`edit-unwanted-pos-${p.id}`}
                      variant={editForm.unwanted_position === p.id ? 'destructive' : 'outline'}
                      className="cursor-pointer min-h-[44px] flex items-center px-4 text-sm"
                      onClick={() => toggleUnwantedPosition(p.id)}
                    >
                      {p.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Opcional. El organizador va a evitar ubicarte ahí si es posible.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rating summary */}
        {metrics && canViewPeerScores && (
          <Card className="border-slate-100 mb-3" data-testid="rating-summary-card">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className={`inline-flex items-center gap-1.5 ${getRatingTone(metrics.general_rating).text}`}>
                    <Star className="w-5 h-5 fill-current" />
                    <span className="font-heading text-3xl font-bold">{metrics.general_rating?.toFixed(1)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider mt-1">Rating General</p>
                </div>
                <div className="text-center border-l border-slate-100">
                  <div className={`inline-flex items-center gap-1.5 ${getRatingTone(metrics.recent_rating).text}`}>
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

        {/* Stats */}
        {metrics && (
          <>
            <div className={`grid grid-cols-2 ${statTiles.length > 3 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3 mb-3`} data-testid="stat-tiles">
              {statTiles.map((s, i) => (
                <StatTile key={i} icon={s.icon} value={s.value} label={s.label} />
              ))}
            </div>
            {!canViewPeerScores && (
              <Card className="border-slate-100 mb-6 bg-slate-50">
                <CardContent className="p-4 text-sm text-slate-600">
                  Los puntajes internos y ratings derivados quedan visibles solo para organizadores y admins.
                  {isOwn ? ' En tu historial vas a seguir viendo tus autoevaluaciones.' : ''}
                </CardContent>
              </Card>
            )}
            {isOwn && metrics.total_matches === 0 && (
              <Card className="border-dashed border-2 border-slate-200 mb-6 bg-slate-50/50">
                <CardContent className="p-5 text-center">
                  <p className="text-sm font-semibold text-slate-700">Todavía no jugaste ningún partido</p>
                  <p className="text-sm text-slate-500 mt-1">Sumate a un partido para empezar a construir tu historial y tu rating.</p>
                  <Link to="/partidos">
                    <Button size="sm" className="mt-3 bg-turf hover:bg-turf-dark text-white rounded-full h-11 px-5 text-sm" data-testid="find-match-cta">
                      Buscar partidos
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </>
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
                  <div className="mt-1 flex flex-wrap gap-2">{profile.secondary_positions.map(p => (
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
        <Link to={`/jugadores/${playerId}/historial`}>
          <Button variant="outline" className="w-full rounded-xl h-12" data-testid="view-history-btn">
            <History className="w-4 h-4 mr-2" /> Ver Historial Completo
          </Button>
        </Link>
      </div>

      <PhotoLightbox
        open={photoLightboxOpen}
        onOpenChange={setPhotoLightboxOpen}
        name={profile.name}
        photoUrl={profile.photo_url}
        subtitle={profile.player_type === 'frecuente' ? 'Jugador Frecuente' : 'Invitado'}
      />
    </div>
  );
}
