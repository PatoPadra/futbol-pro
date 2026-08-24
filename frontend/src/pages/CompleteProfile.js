import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Camera, Loader2, AlertCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/common/PageHeader';
import Reveal from '@/components/common/Reveal';
import PositionPicker from '@/components/players/PositionPicker';
import GenderPicker from '@/components/players/GenderPicker';
import { GENERO_IDS } from '@/constants/generos';

const todayISO = () => new Date().toISOString().split('T')[0];

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Ingresá tu nombre'),
  birth_date: z
    .string()
    .min(1, 'Ingresá tu fecha de nacimiento')
    .refine((v) => v <= todayISO(), 'La fecha de nacimiento no puede ser futura'),
  // Se pide en el alta y no queda opcional porque el balanceador lo usa para
  // repartir los mixtos. "Prefiero no decir" es la salida para quien no lo
  // quiera declarar, así que pedirlo no obliga a nadie a nada.
  gender: z.enum(GENERO_IDS, { errorMap: () => ({ message: 'Elegí una opción' }) }),
  primary_position: z.string().min(1, 'Seleccioná tu posición principal'),
  secondary_positions: z.array(z.string()).max(3).default([]),
  unwanted_position: z.string().default(''),
});

const INPUT_BASE =
  'mt-1.5 h-12 bg-slate-50 focus-visible:ring-2 focus-visible:ring-turf/30';

/**
 * Encabezado de sección del onboarding.
 *
 * Lleva el número del paso adelante: no es un wizard (todo se completa en una
 * sola pantalla y se guarda de una), pero numerar las tres partes convierte una
 * pila de campos en algo que se ve terminable.
 */
function PasoSeccion({ paso, titulo, ayuda, children, testId }) {
  return (
    <Card className="rounded-3xl border-slate-100 shadow-lift" data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-turf/10 font-heading text-lg font-bold leading-none text-turf-accessible"
          >
            {paso}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-xl font-bold uppercase leading-tight tracking-tight text-slate-900">
              {titulo}
            </h2>
            {ayuda && <p className="mt-1 text-sm text-slate-600">{ayuda}</p>}
          </div>
        </div>
        <div className="mt-5">{children}</div>
      </CardContent>
    </Card>
  );
}

export default function CompleteProfile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [positionsError, setPositionsError] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      birth_date: '',
      gender: '',
      primary_position: '',
      secondary_positions: [],
      unwanted_position: '',
    },
  });

  const gender = watch('gender');
  const primaryPosition = watch('primary_position');
  const secondaryPositions = watch('secondary_positions') || [];
  const unwantedPosition = watch('unwanted_position');

  const loadPositions = useCallback(() => {
    setPositionsLoading(true);
    setPositionsError(false);
    api.get('/positions')
      .then(res => setPositions(res.data))
      .catch(() => setPositionsError(true))
      .finally(() => setPositionsLoading(false));
  }, []);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('El archivo tiene que ser una imagen (JPG, PNG, etc.)');
      return;
    }
    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`La imagen no puede superar los ${maxSizeMB}MB`);
      return;
    }

    setPhoto(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const selectPrimary = (posId) => {
    setValue('primary_position', posId, { shouldValidate: true });
    setValue('secondary_positions', secondaryPositions.filter(s => s !== posId), { shouldValidate: true });
  };

  const toggleSecondary = (posId) => {
    if (secondaryPositions.includes(posId)) {
      setValue('secondary_positions', secondaryPositions.filter(p => p !== posId), { shouldValidate: true });
      return;
    }
    if (secondaryPositions.length >= 3) {
      toast.error('Máximo 3 posiciones secundarias');
      return;
    }
    if (posId === primaryPosition) return;
    setValue('secondary_positions', [...secondaryPositions, posId], { shouldValidate: true });
  };

  const toggleUnwanted = (posId) => {
    setValue('unwanted_position', unwantedPosition === posId ? '' : posId, { shouldValidate: true });
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      if (photo) {
        const fd = new FormData();
        fd.append('file', photo);
        await api.post('/profile/photo', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      await api.put('/profile', data);
      updateUser({ has_profile: true });
      toast.success('¡Perfil completado!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos guardar tu perfil. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const onInvalid = (formErrors) => {
    const firstMessage = Object.values(formErrors)[0]?.message;
    if (firstMessage) toast.error(firstMessage);
  };

  return (
    <div className="page-container mx-auto max-w-2xl" data-testid="complete-profile-page">
      <PageHeader
        slug="completar-perfil"
        priority
        icono={Users}
        eyebrow="Último paso antes de jugar"
        titulo="Completá tu perfil"
        bajada="Necesitamos algunos datos para armar equipos equilibrados. Son dos minutos y después ya estás adentro."
        testId="complete-profile-header"
      />

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="mt-6 space-y-5" noValidate>
        {/* Foto */}
        <Reveal from="up" className="block">
          <PasoSeccion
            paso="1"
            titulo="Tu foto"
            ayuda="Ayuda a que tus compañeros te reconozcan en la cancha. La podés cargar después."
          >
            <div className="flex items-center gap-5">
              <label
                className="group cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                data-testid="photo-upload-area"
                tabIndex={0}
                role="button"
                aria-label="Subir foto de perfil"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openFilePicker();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  data-testid="photo-upload-input"
                />
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors group-hover:border-turf group-hover:bg-turf/5 motion-reduce:transition-none">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Vista previa de tu foto de perfil" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-8 w-8 text-slate-600 transition-colors group-hover:text-turf-accessible motion-reduce:transition-none" aria-hidden="true" />
                  )}
                </div>
              </label>
              <div className="text-sm text-slate-600">
                <p className="font-semibold text-slate-900">
                  {photoPreview ? 'Buena foto' : 'Subí tu foto'}
                </p>
                <p className="mt-0.5">
                  {photoPreview
                    ? 'Tocá la imagen si querés cambiarla.'
                    : 'Tocá el cuadro y elegí una imagen de hasta 5 MB.'}
                </p>
              </div>
            </div>
          </PasoSeccion>
        </Reveal>

        {/* Datos básicos */}
        <Reveal from="up" delay={60} className="block">
          <PasoSeccion paso="2" titulo="Tus datos" ayuda="Con la fecha de nacimiento calculamos tu edad. El género lo usamos para repartir parejo los partidos mixtos.">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  data-testid="profile-name-input"
                  disabled={loading}
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  className={`${INPUT_BASE} ${errors.name ? 'border-red-300' : ''}`}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600" data-testid="profile-name-error">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="birth_date">Fecha de nacimiento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  data-testid="profile-birthdate-input"
                  disabled={loading}
                  autoComplete="bday"
                  max={todayISO()}
                  aria-invalid={!!errors.birth_date}
                  className={`${INPUT_BASE} ${errors.birth_date ? 'border-red-300' : ''}`}
                  {...register('birth_date')}
                />
                {errors.birth_date && (
                  <p className="mt-1 text-xs text-red-600" data-testid="birthdate-error">{errors.birth_date.message}</p>
                )}
              </div>
              <div>
                <Label>Género</Label>
                <p className="mt-1 text-xs text-slate-600">
                  Cuando el partido es mixto, lo usamos para que los dos equipos queden parejos.
                </p>
                <GenderPicker
                  className="mt-2"
                  value={gender}
                  onChange={(id) => setValue('gender', id, { shouldValidate: true })}
                  disabled={loading}
                />
                {errors.gender && (
                  <p className="mt-1 text-xs text-red-600" data-testid="gender-error">{errors.gender.message}</p>
                )}
              </div>
            </div>
          </PasoSeccion>
        </Reveal>

        {/* Posiciones */}
        <Reveal from="up" delay={120} className="block">
          <PasoSeccion paso="3" titulo="Dónde jugás" ayuda="Es lo que usamos para repartir los equipos parejos.">
            {positionsLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-600" data-testid="positions-loading">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Cargando posiciones...
              </div>
            ) : positionsError ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-red-50 py-5 text-center" data-testid="positions-error">
                <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
                <p className="text-sm text-red-600">No pudimos cargar las posiciones.</p>
                <Button
                  type="button"
                  variant="outline"
                  shape="pill"
                  onClick={loadPositions}
                  data-testid="positions-retry-btn"
                  className="h-11 bg-white px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                >
                  Reintentar
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-semibold">Posición principal</Label>
                  <PositionPicker
                    className="mt-2"
                    ariaLabel="Posición principal"
                    opciones={positions}
                    seleccion={primaryPosition}
                    testIdPrefix="primary-pos"
                    onToggle={selectPrimary}
                    disabled={loading}
                  />
                  {errors.primary_position && (
                    <p className="mt-2 text-xs text-red-600" data-testid="primary-position-error">{errors.primary_position.message}</p>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-semibold">Posiciones secundarias (máx. 3)</Label>
                  <p className="mt-1 text-xs text-slate-600">Donde también te la rebuscás. Opcional.</p>
                  <PositionPicker
                    className="mt-2"
                    ariaLabel="Posiciones secundarias"
                    opciones={positions.filter(p => p.id !== primaryPosition)}
                    seleccion={secondaryPositions}
                    testIdPrefix="secondary-pos"
                    onToggle={toggleSecondary}
                    disabled={loading}
                    tono="charcoal"
                  />
                </div>

                <div>
                  <Label className="text-sm font-semibold">Posición no deseada (opcional)</Label>
                  <p className="mt-1 text-xs text-slate-600">El organizador va a evitar ponerte ahí si puede.</p>
                  <PositionPicker
                    className="mt-2"
                    ariaLabel="Posición no deseada"
                    opciones={positions}
                    seleccion={unwantedPosition}
                    testIdPrefix="unwanted-pos"
                    onToggle={toggleUnwanted}
                    disabled={loading}
                    tono="danger"
                    marca="cruz"
                  />
                </div>
              </div>
            )}
          </PasoSeccion>
        </Reveal>

        <Button
          type="submit"
          shape="pill"
          data-testid="save-profile-btn"
          disabled={loading || positionsLoading}
          className="h-12 w-full bg-turf text-base text-white shadow-lift-turf hover:bg-turf-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {loading ? 'Guardando...' : 'Guardar y Continuar'}
        </Button>

        <p className="pb-2 text-center text-xs text-slate-600">
          Después podés cambiar todo esto desde tu perfil.
        </p>
      </form>
    </div>
  );
}
