import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { badgeVariants } from '../components/ui/badge';
import { Camera, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const todayISO = () => new Date().toISOString().split('T')[0];

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Ingresá tu nombre'),
  birth_date: z
    .string()
    .min(1, 'Ingresá tu fecha de nacimiento')
    .refine((v) => v <= todayISO(), 'La fecha de nacimiento no puede ser futura'),
  primary_position: z.string().min(1, 'Seleccioná tu posición principal'),
  secondary_positions: z.array(z.string()).max(3).default([]),
  unwanted_position: z.string().default(''),
});

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
      primary_position: '',
      secondary_positions: [],
      unwanted_position: '',
    },
  });

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
    <div className="page-container max-w-2xl mx-auto" data-testid="complete-profile-page">
      <div className="animate-slide-up">
        <p className="text-xs font-semibold uppercase tracking-wider text-turf-accessible">Último paso antes de jugar</p>
        <h1 className="font-heading text-4xl md:text-5xl font-bold uppercase tracking-tight mt-1">
          Completá tu perfil
        </h1>
        <p className="mt-2 text-slate-500">Necesitamos algunos datos para armar equipos equilibrados.</p>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="mt-8 space-y-6" noValidate>
          {/* Photo */}
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase">Foto de perfil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <label
                  className="cursor-pointer group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
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
                  <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 group-hover:border-turf flex items-center justify-center overflow-hidden transition-colors">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Vista previa de tu foto de perfil" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-slate-400 group-hover:text-turf-accessible transition-colors" />
                    )}
                  </div>
                </label>
                <div className="text-sm text-slate-500">
                  <p className="font-medium text-slate-700">Subí tu foto</p>
                  <p>Ayuda a que tus compañeros te reconozcan en la cancha.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase">Datos básicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  data-testid="profile-name-input"
                  disabled={loading}
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  className={`mt-1.5 h-12 bg-slate-50 focus-visible:ring-2 focus-visible:ring-turf/30 ${errors.name ? 'border-red-300' : ''}`}
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
                  className={`mt-1.5 h-12 bg-slate-50 focus-visible:ring-2 focus-visible:ring-turf/30 ${errors.birth_date ? 'border-red-300' : ''}`}
                  {...register('birth_date')}
                />
                {errors.birth_date && (
                  <p className="mt-1 text-xs text-red-600" data-testid="birthdate-error">{errors.birth_date.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Positions */}
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase">Posiciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {positionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-4" data-testid="positions-loading">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Cargando posiciones...
                </div>
              ) : positionsError ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center" data-testid="positions-error">
                  <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
                  <p className="text-sm text-red-600">No pudimos cargar las posiciones.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadPositions}
                    data-testid="positions-retry-btn"
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                  >
                    Reintentar
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-sm font-medium">Posición principal</Label>
                    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Posición principal">
                      {positions.map(p => {
                        const selected = primaryPosition === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            data-testid={`primary-pos-${p.id}`}
                            aria-pressed={selected}
                            disabled={loading}
                            className={cn(
                              badgeVariants({ variant: selected ? 'default' : 'outline' }),
                              'min-h-11 cursor-pointer text-sm py-1.5 px-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2',
                              selected
                                ? 'bg-turf text-white hover:bg-turf-dark border-turf'
                                : 'hover:border-turf hover:text-turf-accessible'
                            )}
                            onClick={() => selectPrimary(p.id)}
                          >
                            {selected && <Check className="w-3 h-3 mr-1" />}
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                    {errors.primary_position && (
                      <p className="mt-1.5 text-xs text-red-600" data-testid="primary-position-error">{errors.primary_position.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Posiciones secundarias (máx. 3)</Label>
                    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Posiciones secundarias">
                      {positions.filter(p => p.id !== primaryPosition).map(p => {
                        const selected = secondaryPositions.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            data-testid={`secondary-pos-${p.id}`}
                            aria-pressed={selected}
                            disabled={loading}
                            className={cn(
                              badgeVariants({ variant: selected ? 'default' : 'outline' }),
                              'min-h-11 cursor-pointer text-sm py-1.5 px-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2',
                              selected
                                ? 'bg-slate-800 text-white hover:bg-slate-700 border-slate-800'
                                : 'hover:border-slate-400'
                            )}
                            onClick={() => toggleSecondary(p.id)}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Posición no deseada (opcional)</Label>
                    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Posición no deseada">
                      {positions.map(p => {
                        const selected = unwantedPosition === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            data-testid={`unwanted-pos-${p.id}`}
                            aria-pressed={selected}
                            disabled={loading}
                            className={cn(
                              badgeVariants({ variant: selected ? 'destructive' : 'outline' }),
                              'min-h-11 cursor-pointer text-sm py-1.5 px-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
                              !selected && 'hover:border-red-300 hover:text-red-600'
                            )}
                            onClick={() => toggleUnwanted(p.id)}
                          >
                            {selected && <X className="w-3 h-3 mr-1" />}
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button
            type="submit"
            data-testid="save-profile-btn"
            disabled={loading || positionsLoading}
            className="w-full h-12 bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {loading ? 'Guardando...' : 'Guardar y Continuar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
