import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { badgeVariants } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { Slider } from '../components/ui/slider';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form';
import { Check, UserPlus, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function levelLabel(v) {
  if (v <= 2.5) return 'Principiante';
  if (v <= 5) return 'Intermedio';
  if (v <= 7.5) return 'Avanzado';
  return 'Experto';
}

const guestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(60, 'El nombre es demasiado largo'),
  email: z.string().trim().email('Ingresá un email válido').optional().or(z.literal('')),
  primary_position: z.string().optional(),
  estimated_level: z.number().min(1).max(10),
});

export default function CreateGuest() {
  const navigate = useNavigate();
  const [positions, setPositions] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('idle'); // idle | creating | uploading
  const photoPreviewRef = useRef(null);

  const form = useForm({
    resolver: zodResolver(guestSchema),
    defaultValues: { name: '', email: '', primary_position: '', estimated_level: 5 },
  });

  const { control, handleSubmit, watch, setValue } = form;
  const selectedPosition = watch('primary_position');
  const selectedLevel = watch('estimated_level');

  useEffect(() => {
    api.get('/positions').then(res => setPositions(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    photoPreviewRef.current = photoPreview;
  }, [photoPreview]);

  useEffect(() => () => {
    if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
  }, []);

  const handlePhotoChange = (e) => {
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

    if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (data) => {
    setLoading(true);
    setStep('creating');

    let guestId = null;
    try {
      const res = await api.post('/players/guest', {
        ...data,
        email: data.email || null,
        primary_position: data.primary_position || null,
      });
      guestId = res.data.id;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo crear el invitado');
      setLoading(false);
      setStep('idle');
      return;
    }

    let photoFailed = false;
    if (photo && guestId) {
      setStep('uploading');
      try {
        const fd = new FormData();
        fd.append('file', photo);
        await api.post(`/players/${guestId}/photo`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (err) {
        photoFailed = true;
      }
    }

    toast.success(
      photoFailed
        ? 'Invitado creado. No pudimos subir la foto, la podés agregar luego desde su perfil.'
        : '¡Invitado creado!'
    );
    setLoading(false);
    setStep('idle');
    navigate(-1);
  };

  return (
    <div className="page-container max-w-lg mx-auto" data-testid="create-guest-page">
      <div className="animate-slide-up">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mb-2">Invitar Jugador</h1>
        <p className="text-slate-500 mb-8">Creá un perfil para un invitado que no tiene cuenta.</p>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <Card className="border-slate-100">
              <CardContent className="p-5 space-y-4">
                {/* Photo upload */}
                <div className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    <label className="cursor-pointer group block" data-testid="guest-photo-upload">
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only peer"
                        onChange={handlePhotoChange}
                        data-testid="guest-photo-input"
                      />
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 group-hover:border-turf peer-focus-visible:border-turf peer-focus-visible:ring-2 peer-focus-visible:ring-turf/40 peer-focus-visible:ring-offset-2 flex items-center justify-center overflow-hidden transition-colors">
                        {photoPreview ? (
                          <img src={photoPreview} alt="Vista previa de la foto del invitado" className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="w-7 h-7 text-slate-400 group-hover:text-turf-accessible transition-colors" />
                        )}
                      </div>
                    </label>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
                          setPhoto(null);
                          setPhotoPreview(null);
                        }}
                        className="absolute -top-3 -right-3 w-11 h-11 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 rounded-full"
                        aria-label="Quitar foto"
                        data-testid="guest-photo-remove"
                      >
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md pointer-events-none">
                          <span className="text-xs leading-none">×</span>
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-slate-500">
                    <p className="font-medium text-slate-700">Foto (opcional)</p>
                    <p>Subí una foto para que lo reconozcan. Máx. 5 MB.</p>
                  </div>
                </div>

                <FormField
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Nombre del invitado <span className="text-orange">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="guest-name-input"
                          placeholder="Nombre del jugador"
                          className="mt-1.5 h-12 bg-slate-50"
                        />
                      </FormControl>
                      <FormMessage data-testid="guest-name-error" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          data-testid="guest-email-input"
                          placeholder="email@invitado.com"
                          className="mt-1.5 h-12 bg-slate-50"
                        />
                      </FormControl>
                      <p className="text-xs text-slate-400">
                        Si lo cargás, cuando se cree una cuenta con ese email va a recuperar automáticamente su historial de partidos.
                      </p>
                      <FormMessage data-testid="guest-email-error" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="primary_position"
                  render={() => (
                    <FormItem>
                      <FormLabel>Posición estimada (opcional)</FormLabel>
                      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Posición estimada">
                        {positions.map(p => {
                          const selected = selectedPosition === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              data-testid={`guest-pos-${p.id}`}
                              aria-pressed={selected}
                              className={cn(
                                badgeVariants({ variant: selected ? 'default' : 'outline' }),
                                'min-h-11 cursor-pointer text-sm py-1.5 px-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2',
                                selected ? 'bg-turf text-white border-turf' : 'hover:border-turf hover:text-turf-accessible'
                              )}
                              onClick={() => setValue('primary_position', selected ? '' : p.id, { shouldValidate: true })}
                            >
                              {selected && <Check className="w-3 h-3 mr-1" />}
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage data-testid="guest-position-error" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="estimated_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Nivel estimado: {selectedLevel}{' '}
                        <span className="text-slate-400 font-normal normal-case">· {levelLabel(selectedLevel)}</span>
                      </FormLabel>
                      <FormControl>
                        <Slider
                          data-testid="guest-level-slider"
                          min={1}
                          max={10}
                          step={0.5}
                          value={[field.value]}
                          onValueChange={v => field.onChange(v[0])}
                          className="mt-3"
                          aria-label="Nivel estimado del jugador"
                        />
                      </FormControl>
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>Principiante</span>
                        <span>Experto</span>
                      </div>
                      <FormMessage data-testid="guest-level-error" />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Button
              type="submit"
              data-testid="create-guest-submit"
              disabled={loading}
              className="w-full h-12 bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              {step === 'creating' && 'Creando...'}
              {step === 'uploading' && 'Subiendo foto...'}
              {step === 'idle' && 'Crear Invitado'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
