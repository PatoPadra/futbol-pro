import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import PhotoLightbox from '../components/common/PhotoLightbox';
import {
  Edit3, Save, X, History, Trophy, UserX, User, Info, IdCard, Compass,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildPhotoUrl } from '@/utils/photos';
import PageLoader from '@/components/common/PageLoader';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import Reveal from '@/components/common/Reveal';
import MetricTiles from '@/components/players/MetricTiles';
import FormGuide from '@/components/players/FormGuide';
import MatchTypeSplit from '@/components/players/MatchTypeSplit';
import RatingPanel from '@/components/players/RatingPanel';
import PositionPicker from '@/components/players/PositionPicker';
import PlayerIdentityCard from '@/components/players/PlayerIdentityCard';
import GenderPicker from '@/components/players/GenderPicker';
import { labelDeFicha } from '@/constants/generos';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Chip de la banda del encabezado: sobre foto, siempre blanco sobre vidrio oscuro. */
const CHIP_SOBRE_FOTO =
  'glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white';

const profileFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  birth_date: z.string().optional().or(z.literal('')),
  // Opcional acá aunque el onboarding lo pida: en la edición se tiene que poder
  // borrar lo que se cargó, y un required lo dejaría trabado para siempre.
  gender: z.string().optional().or(z.literal('')),
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
  const [record, setRecord] = useState(null);
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
      gender: '',
      primary_position: '',
      secondary_positions: [],
      unwanted_position: '',
    },
  });

  const editForm = watch();

  useEffect(() => {
    const load = async () => {
      try {
        const [profileRes, metricsRes, recordRes, posRes] = await Promise.all([
          isOwn ? api.get('/profile') : api.get(`/players/${playerId}`),
          api.get(`/players/${playerId}/metrics`).catch(() => ({ data: null })),
          api.get(`/players/${playerId}/record`).catch(() => ({ data: null })),
          api.get('/positions'),
        ]);
        setProfile(profileRes.data);
        setMetrics(metricsRes.data);
        setRecord(recordRes.data);
        setPositions(posRes.data || []);
        reset({
          name: profileRes.data.name,
          birth_date: profileRes.data.birth_date || '',
          gender: profileRes.data.gender || '',
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
      // `gender` viaja como null y no como '': el backend lo valida contra una
      // lista cerrada de valores y '' no está en ella. null es "sin declarar".
      await api.put('/profile', { ...values, gender: values.gender || null });
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

  const selectPrimaryPosition = (posId) => {
    setValue('primary_position', posId, { shouldDirty: true });
    setValue('secondary_positions', (editForm.secondary_positions || []).filter(id2 => id2 !== posId), { shouldDirty: true });
    if (editForm.unwanted_position === posId) {
      setValue('unwanted_position', '', { shouldDirty: true });
    }
  };

  const posMap = {};
  positions.forEach(p => { posMap[p.id] = p.name; });

  if (loading) {
    return <div data-testid="player-profile-loading"><PageLoader /></div>;
  }

  if (!profile) {
    return (
      <div className="page-container mx-auto max-w-md">
        <EmptyState
          variante={5}
          icono={UserX}
          titulo="Jugador no encontrado"
          descripcion="Puede que el perfil no exista o que no tengas acceso a él."
          testId="player-profile-not-found"
          accion={(
            <Button
              shape="pill"
              onClick={() => navigate(-1)}
              data-testid="profile-not-found-back-btn"
              className="glass-dark h-11 border border-white/25 bg-white/10 px-6 text-white hover:bg-white/20 focus-visible:ring-white focus-visible:ring-offset-transparent"
            >
              Volver
            </Button>
          )}
        />
      </div>
    );
  }

  const photoUrl = buildPhotoUrl(profile.photo_url);
  const canViewPeerScores = Boolean(metrics?.can_view_peer_scores);
  const confidence = metrics ? confidenceMeta(metrics.confidence_index) : null;
  const secondaryOptions = positions.filter(p => p.id !== editForm.primary_position);
  const unwantedOptions = positions.filter(p => p.id !== editForm.primary_position && !(editForm.secondary_positions || []).includes(p.id));

  const statTiles = [
    { label: 'Partidos', value: metrics?.total_matches ?? 0 },
    { label: 'Goles', value: metrics?.total_goals ?? 0 },
    { label: 'Asistencias', value: metrics?.total_assists ?? 0 },
    ...(metrics?.total_saves > 0 ? [{ label: 'Atajadas', value: metrics.total_saves }] : []),
  ];

  const tipoJugador = profile.player_type === 'frecuente' ? 'Jugador Frecuente' : 'Invitado';
  const posicionPrincipal = profile.primary_position
    ? (posMap[profile.primary_position] || profile.primary_position)
    : null;
  const bajada = posicionPrincipal
    ? `${isOwn ? 'Jugás' : 'Juega'} de ${posicionPrincipal}.`
    : `${isOwn ? 'Todavía no elegiste' : 'Todavía no eligió'} posición principal.`;

  return (
    <div className="page-container mx-auto max-w-2xl" data-testid="player-profile-page">
      {/*
        El pie extra de la banda (`pb-11`) es el hueco donde encaja la ficha: la
        tarjeta sube 32px sobre el encabezado y ahí abajo no hay texto que tapar.
      */}
      <PageHeader
        slug="perfil"
        priority
        icono={User}
        className="pb-11 md:pb-12"
        eyebrow={isOwn ? 'Tu ficha' : 'Ficha del jugador'}
        titulo={profile.name}
        bajada={bajada}
        testId="player-profile-header"
        meta={(
          <>
            <span className={CHIP_SOBRE_FOTO}>{tipoJugador}</span>
            {profile.age && <span className={CHIP_SOBRE_FOTO}>{profile.age} años</span>}
            {labelDeFicha(profile.gender) && (
              <span className={CHIP_SOBRE_FOTO} data-testid="profile-gender-chip">
                {labelDeFicha(profile.gender)}
              </span>
            )}
            {metrics && (
              <span className={CHIP_SOBRE_FOTO}>
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                {metrics.total_matches ?? 0} {metrics.total_matches === 1 ? 'partido' : 'partidos'}
              </span>
            )}
          </>
        )}
        acciones={isOwn ? (
          editing ? (
            <>
              <Button
                shape="pill"
                onClick={handleSave}
                className="h-11 bg-turf-btn px-5 text-white hover:bg-turf-btn-dark focus-visible:ring-white focus-visible:ring-offset-transparent"
                data-testid="save-edit-btn"
              >
                <Save className="mr-1 h-4 w-4" /> Guardar
              </Button>
              <Button
                shape="pill"
                onClick={() => setEditing(false)}
                aria-label="Cancelar edición"
                data-testid="cancel-edit-btn"
                className="glass-dark h-11 w-11 border border-white/25 bg-white/10 p-0 text-white hover:bg-white/20 focus-visible:ring-white focus-visible:ring-offset-transparent"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              shape="pill"
              onClick={() => setEditing(true)}
              data-testid="edit-profile-btn"
              className="glass-dark h-11 border border-white/25 bg-white/10 px-5 text-white hover:bg-white/20 focus-visible:ring-white focus-visible:ring-offset-transparent"
            >
              <Edit3 className="mr-1 h-4 w-4" /> Editar
            </Button>
          )
        ) : null}
      />

      <div className="relative z-10 mx-1 -mt-8 md:mx-5">
        <PlayerIdentityCard
          profile={profile}
          photoUrl={photoUrl}
          posMap={posMap}
          isOwn={isOwn}
          uploadingPhoto={uploadingPhoto}
          onPhotoChange={handlePhotoUpload}
          onOpenLightbox={() => setPhotoLightboxOpen(true)}
        />
      </div>

      {/* Edición del perfil */}
      {editing && (
        <Reveal from="up" className="mt-6 block">
          <Card className="rounded-3xl border-slate-100 shadow-lift">
            <CardContent className="space-y-7 p-5">
              <section>
                <SeccionTitulo icono={IdCard} titulo="Tus datos" />
                <div className="mt-3 space-y-4">
                  <div>
                    <Label htmlFor="edit-name">Nombre</Label>
                    <Input id="edit-name" className="mt-1.5 h-12 bg-slate-50" data-testid="edit-name" {...register('name')} />
                    {errors.name && (
                      <p className="mt-1 text-xs text-destructive" data-testid="edit-name-error">{errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="edit-birthdate">Fecha de nacimiento</Label>
                    <Input id="edit-birthdate" type="date" className="mt-1.5 h-12 bg-slate-50" data-testid="edit-birthdate" {...register('birth_date')} />
                    {errors.birth_date && (
                      <p className="mt-1 text-xs text-destructive" data-testid="edit-birthdate-error">{errors.birth_date.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Género</Label>
                    <p className="mt-1 text-xs text-slate-600">
                      Se usa para repartir parejo los equipos en los partidos mixtos.
                    </p>
                    <GenderPicker
                      className="mt-2"
                      testIdPrefix="edit-gender"
                      value={editForm.gender || ''}
                      onChange={(id) => setValue('gender', id, { shouldDirty: true })}
                    />
                  </div>
                </div>
              </section>

              <section>
                <SeccionTitulo icono={Compass} titulo="Dónde jugás" />
                <div className="mt-3 space-y-5">
                  <div>
                    <Label>Posición principal</Label>
                    <PositionPicker
                      className="mt-2"
                      ariaLabel="Posición principal"
                      opciones={positions}
                      seleccion={editForm.primary_position}
                      testIdPrefix="edit-primary-pos"
                      onToggle={selectPrimaryPosition}
                    />
                  </div>
                  <div>
                    <Label>Posiciones secundarias</Label>
                    <PositionPicker
                      className="mt-2"
                      ariaLabel="Posiciones secundarias"
                      opciones={secondaryOptions}
                      seleccion={editForm.secondary_positions || []}
                      testIdPrefix="edit-secondary-pos"
                      onToggle={toggleSecondaryPosition}
                      tono="charcoal"
                    />
                    <p className="mt-2 text-xs text-slate-600">Elegí hasta 3 posiciones donde también te sentís cómodo jugando.</p>
                  </div>
                  <div>
                    <Label>Posición que preferís evitar</Label>
                    <PositionPicker
                      className="mt-2"
                      ariaLabel="Posición que preferís evitar"
                      opciones={unwantedOptions}
                      seleccion={editForm.unwanted_position}
                      testIdPrefix="edit-unwanted-pos"
                      onToggle={toggleUnwantedPosition}
                      tono="danger"
                      marca="cruz"
                    />
                    <p className="mt-2 text-xs text-slate-600">Opcional. El organizador va a evitar ubicarte ahí si es posible.</p>
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>
        </Reveal>
      )}

      {/* Racha. Va antes que el rating y las métricas porque es lo primero que
          alguien busca al abrir un perfil, y porque no depende de permisos:
          quién ganó el sábado lo vieron los veintidós. */}
      {record && (
        <Reveal from="up" delay={45} className="mt-6 block">
          <FormGuide record={record} />
        </Reveal>
      )}

      {/* Rating */}
      {metrics && canViewPeerScores && (
        <Reveal from="up" delay={60} className="mt-6 block">
          <RatingPanel metrics={metrics} confidence={confidence} testId="rating-summary-card" />
        </Reveal>
      )}

      {/* Oficiales contra prácticas. Se muestra aunque los puntajes estén
          ocultos: los conteos y el "te faltan X" no son datos reservados. */}
      {metrics?.match_type_split && (
        <Reveal from="up" delay={75} className="mt-4 block">
          <MatchTypeSplit split={metrics.match_type_split} esPropio={isOwn} />
        </Reveal>
      )}

      {/* Métricas */}
      {metrics && (
        <>
          <Reveal from="up" delay={90} className="mt-4 block">
            <MetricTiles tiles={statTiles} testId="stat-tiles" />
          </Reveal>

          {!canViewPeerScores && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
              <p>
                Los puntajes internos y ratings derivados quedan visibles solo para organizadores y admins.
                {isOwn ? ' En tu historial vas a seguir viendo tus autoevaluaciones.' : ''}
              </p>
            </div>
          )}

          {isOwn && metrics.total_matches === 0 && (
            <Reveal from="up" delay={120} className="mt-4 block">
              <EmptyState
                variante={1}
                icono={Trophy}
                titulo="Todavía no jugaste ningún partido"
                descripcion="Sumate a un partido para empezar a construir tu historial y tu rating."
                accion={(
                  <Link to="/partidos">
                    <Button
                      shape="pill"
                      className="h-11 bg-turf-btn px-6 text-white hover:bg-turf-btn-dark focus-visible:ring-white focus-visible:ring-offset-transparent"
                      data-testid="find-match-cta"
                    >
                      Buscar partidos
                    </Button>
                  </Link>
                )}
              />
            </Reveal>
          )}
        </>
      )}

      {/* Historial */}
      <Link to={`/jugadores/${playerId}/historial`} className="mt-6 block">
        <Button
          variant="outline"
          shape="pill"
          className="h-12 w-full border-2 border-slate-200 text-slate-700 hover:border-turf/40 hover:text-turf-accessible"
          data-testid="view-history-btn"
        >
          <History className="mr-2 h-4 w-4" /> Ver Historial Completo
        </Button>
      </Link>

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

function SeccionTitulo({ icono: Icono, titulo }) {
  return (
    <h2 className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-tight text-slate-900">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 place-items-center rounded-xl bg-turf/10 text-turf-accessible"
      >
        <Icono className="h-4 w-4" />
      </span>
      {titulo}
    </h2>
  );
}
