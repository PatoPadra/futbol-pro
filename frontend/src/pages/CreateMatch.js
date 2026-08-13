import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form';

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const capacities = { 5: 10, 6: 12, 7: 14, 8: 16, 9: 18, 10: 20, 11: 22 };

const matchSchema = z.object({
  group_id: z.string().min(1, 'Seleccioná un grupo'),
  title: z
    .string()
    .trim()
    .min(3, 'El título debe tener al menos 3 caracteres')
    .max(100, 'El título es demasiado largo'),
  modality: z.enum(['5', '6', '7', '8', '9', '10', '11']),
  date: z
    .string()
    .min(1, 'Seleccioná una fecha')
    .refine((value) => value >= TODAY_ISO, 'La fecha no puede ser anterior a hoy'),
  time: z.string().min(1, 'Seleccioná un horario'),
  location: z
    .string()
    .trim()
    .min(3, 'Ingresá un lugar válido')
    .max(150, 'El lugar es demasiado largo'),
  maps_link: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || /^https?:\/\/\S+$/i.test(value),
      'Ingresá un link válido (debe empezar con http:// o https://)'
    ),
  is_recurring: z.boolean(),
});

export default function CreateMatch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedGroupId = searchParams.get('group_id') || '';

  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groups, setGroups] = useState([]);

  const form = useForm({
    resolver: zodResolver(matchSchema),
    defaultValues: {
      group_id: '',
      title: '',
      modality: '5',
      date: '',
      time: '',
      location: '',
      maps_link: '',
      is_recurring: false,
    },
  });

  const { control, handleSubmit, setValue, watch } = form;
  const selectedModality = watch('modality');

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const res = await api.get('/groups');
        const organizerGroups = (res.data || []).filter(
          (group) => group.my_member_role === 'organizador' || group.my_member_role === 'admin'
        );
        setGroups(organizerGroups);

        if (requestedGroupId && organizerGroups.some((group) => group.id === requestedGroupId)) {
          setValue('group_id', requestedGroupId);
        } else if (organizerGroups.length === 1) {
          setValue('group_id', organizerGroups[0].id);
        }
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Error al cargar grupos');
      } finally {
        setLoadingGroups(false);
      }
    };

    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedGroupId]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        maps_link: data.maps_link || undefined,
        modality: parseInt(data.modality, 10),
      };

      const res = await api.post('/matches', payload);
      toast.success('¡Partido creado!');
      navigate(`/partidos/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear partido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-2xl mx-auto" data-testid="create-match-page">
      <div className="animate-slide-up">
        <h1 className="font-heading text-4xl md:text-5xl font-bold uppercase tracking-tight mb-2">
          Crear Partido
        </h1>
        <p className="text-slate-500 mb-8">Configurá los detalles del partido.</p>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <Card className="border-slate-100">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-lg uppercase">Detalles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={control}
                  name="group_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grupo</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={loadingGroups || groups.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger className="mt-1.5 h-12 bg-slate-50" data-testid="match-group-select">
                            <SelectValue placeholder={loadingGroups ? 'Cargando grupos...' : 'Seleccioná un grupo'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage data-testid="match-group-error" />
                      {!loadingGroups && groups.length === 0 && (
                        <div
                          className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2"
                          data-testid="no-groups-notice"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <div className="text-sm">
                            <p className="text-amber-900">No tenés grupos donde puedas crear partidos todavía.</p>
                            <Link
                              to="/grupos/crear"
                              data-testid="create-first-group-link"
                              className="inline-block mt-1 font-semibold text-turf-accessible hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                            >
                              Crear mi primer grupo
                            </Link>
                          </div>
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título del partido</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="match-title-input"
                          placeholder="Ej: Partido del sábado"
                          className="mt-1.5 h-12 bg-slate-50"
                        />
                      </FormControl>
                      <FormMessage data-testid="match-title-error" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="modality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modalidad</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="mt-1.5 h-12 bg-slate-50" data-testid="match-modality-select">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[5, 6, 7, 8, 9, 10, 11].map((value) => (
                            <SelectItem key={value} value={String(value)}>
                              Fútbol {value} ({capacities[value]} jugadores)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage data-testid="match-modality-error" />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            data-testid="match-date-input"
                            min={TODAY_ISO}
                            className="mt-1.5 h-12 bg-slate-50"
                          />
                        </FormControl>
                        <FormMessage data-testid="match-date-error" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="time"
                            data-testid="match-time-input"
                            className="mt-1.5 h-12 bg-slate-50"
                          />
                        </FormControl>
                        <FormMessage data-testid="match-time-error" />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lugar</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="match-location-input"
                          placeholder="Ej: Cancha Municipal"
                          className="mt-1.5 h-12 bg-slate-50"
                        />
                      </FormControl>
                      <FormMessage data-testid="match-location-error" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="maps_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link de ubicación (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="url"
                          data-testid="match-maps-input"
                          placeholder="https://maps.google.com/..."
                          className="mt-1.5 h-12 bg-slate-50"
                        />
                      </FormControl>
                      <FormMessage data-testid="match-maps-error" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="is_recurring"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between py-2 space-y-0">
                      <div>
                        <FormLabel className="font-medium">Partido recurrente</FormLabel>
                        <p className="text-xs text-slate-500">Se repite semanalmente</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="match-recurring-switch"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-sm text-slate-600">
                <strong>Capacidad:</strong> {capacities[parseInt(selectedModality, 10)]} titulares (Fútbol {selectedModality}). Los jugadores que se anoten luego del cupo quedarán como suplentes. El cierre de inscripción será el día del partido al mediodía.
              </p>
            </div>

            <Button
              type="submit"
              data-testid="create-match-submit"
              disabled={loading || loadingGroups || groups.length === 0}
              className="w-full h-12 bg-turf hover:bg-turf-dark text-white rounded-full font-bold uppercase tracking-wider transition-transform active:scale-95 shadow-lg shadow-turf/20 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 disabled:active:scale-100"
            >
              {loading ? 'Creando...' : 'Crear Partido'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
