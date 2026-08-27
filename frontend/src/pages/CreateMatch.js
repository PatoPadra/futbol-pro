import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle, CalendarPlus, Clock, Gauge, LayoutGrid, MapPin, Repeat, Users } from 'lucide-react';

import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form';
import PageHeader from '@/components/common/PageHeader';
import Panel from '@/components/matches/Panel';
import OptionCards from '@/components/matches/OptionCards';
import StatPicker from '@/components/matches/StatPicker';
import useMatchCatalogs from '@/hooks/use-match-catalogs';

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const capacities = { 5: 10, 6: 12, 7: 14, 8: 16, 9: 18, 10: 20, 11: 22 };

/** Un solo lugar para el alto y el fondo de los inputs del formulario. */
const FIELD = 'mt-1.5 h-12 bg-slate-50';

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
  // El modo se valida en el backend contra el catálogo. Acá alcanza con que sea
  // un string: repetir la lista de modos en el front es exactamente la
  // duplicación que este diseño trata de evitar.
  mode: z.string().optional(),
  match_type: z.string().min(1),
  tracked_stats: z.array(z.string()),
  opponent_name: z.string().trim().max(80, 'El nombre es demasiado largo'),
});

export default function CreateMatch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedGroupId = searchParams.get('group_id') || '';

  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groups, setGroups] = useState([]);
  const { modes, types, trackableStats, defaultTrackedStats, defaultType } = useMatchCatalogs();

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
      mode: '',
      match_type: 'oficial',
      tracked_stats: [],
      opponent_name: '',
    },
  });

  const { control, handleSubmit, setValue, watch } = form;
  const selectedModality = watch('modality');
  const selectedGroupId = watch('group_id');
  const selectedMode = watch('mode');

  // Las capacidades del modo elegido salen del mismo catálogo que usa el
  // backend, así que la pantalla no tiene una tabla propia que pueda divergir.
  const capacidades = modes.find((m) => m.id === selectedMode)?.capabilities || {};
  const eligeEstadisticas = Boolean(capacidades.stats_configurables);
  // Cuando el rival no está en la app hay que preguntarle el nombre a alguien.
  // La condición sale de la capacidad y no de `modo === 'entrenador'`: la tabla
  // de modos vive en el backend y esta pantalla no tiene por qué repetirla.
  const juegaContraAfuera = capacidades.opponent === 'externo';
  const rival = watch('opponent_name');
  const faltaElRival = juegaContraAfuera && !rival?.trim();

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

  // Al elegir grupo, el modo arranca en el que ese grupo tiene configurado. Si
  // después se cambia de grupo el modo vuelve a sincronizarse, aunque ya se
  // hubiera tocado: el default del grupo nuevo es una respuesta más razonable
  // que arrastrar la elección hecha pensando en otro. Y el cambio se ve — las
  // tarjetas muestran cuál quedó elegida.
  useEffect(() => {
    if (!selectedGroupId) return;
    const grupo = groups.find((g) => g.id === selectedGroupId);
    if (grupo?.default_match_mode) {
      setValue('mode', grupo.default_match_mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, groups]);

  // El tipo por default sale del catálogo, no de un literal repetido acá.
  useEffect(() => {
    if (defaultType) setValue('match_type', defaultType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultType]);

  // Al pasar a un modo que deja elegir estadísticas, arrancan tildadas las dos
  // razonables. Al salir de ese modo se vacía: dejar la lista colgada haría que
  // volver a entrar muestre la elección de un modo que ya no está.
  useEffect(() => {
    setValue('tracked_stats', eligeEstadisticas ? [...defaultTrackedStats] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligeEstadisticas, defaultTrackedStats]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        maps_link: data.maps_link || undefined,
        modality: parseInt(data.modality, 10),
        // Sin modo elegido no se manda el campo: el backend hereda el del grupo.
        // Mandar '' sería un 422, y mandar un default del front pisaría al grupo.
        mode: data.mode || undefined,
        // Sólo cuando el modo las deja elegir. En los demás el backend resuelve
        // la lista solo, y mandar una lista vacía se leería como "no quiero
        // ninguna" en vez de "no me corresponde elegir".
        tracked_stats: eligeEstadisticas ? data.tracked_stats : undefined,
        opponent_name: juegaContraAfuera ? data.opponent_name.trim() : undefined,
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
      <div className="animate-slide-up space-y-6">
        <PageHeader
          slug="crear-partido"
          eyebrow="Nueva fecha"
          titulo="Crear partido"
          bajada="Cuatro cosas y listo: quiénes, con qué formato, cuándo y dónde."
          volverA="/partidos"
          volverLabel="Partidos"
          icono={CalendarPlus}
          testId="create-match-header"
        />

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <Panel
              icono={Users}
              titulo="¿Quiénes juegan?"
              bajada="El grupo al que le sale el partido y cómo lo van a reconocer en la lista."
              tono="turf"
              testId="create-match-quienes"
              contentClassName="space-y-4 p-4 sm:p-5"
            >
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
                        <SelectTrigger className={FIELD} data-testid="match-group-select">
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
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                        <div className="text-sm">
                          <p className="text-amber-900">No tenés grupos donde puedas crear partidos todavía.</p>
                          <Link
                            to="/grupos/crear"
                            data-testid="create-first-group-link"
                            className="inline-flex min-h-[44px] items-center font-semibold text-turf-accessible hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
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
                        className={FIELD}
                      />
                    </FormControl>
                    <FormMessage data-testid="match-title-error" />
                  </FormItem>
                )}
              />

              {juegaContraAfuera && (
                <FormField
                  control={control}
                  name="opponent_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contra quién juegan</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="match-opponent-input"
                          placeholder="Ej: Deportivo Español"
                          className={FIELD}
                        />
                      </FormControl>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                        El rival no está en la app: alcanza con el nombre para que
                        aparezca en el marcador y en el historial.
                      </p>
                      <FormMessage data-testid="match-opponent-error" />
                    </FormItem>
                  )}
                />
              )}
            </Panel>

            <Panel
              icono={LayoutGrid}
              titulo="¿Qué formato?"
              bajada="La modalidad define el cupo de titulares."
              tono="orange"
              testId="create-match-formato"
              contentClassName="space-y-4 p-4 sm:p-5"
            >
              <FormField
                control={control}
                name="modality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modalidad</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className={FIELD} data-testid="match-modality-select">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[5, 6, 7, 8, 9, 10, 11].map((value) => (
                          <SelectItem key={value} value={String(value)}>
                            <span className="flex items-center gap-2">
                              <span aria-hidden="true" className="flex gap-0.5 shrink-0">
                                {Array.from({ length: 7 }).map((_, di) => (
                                  <span
                                    key={di}
                                    className={`w-1.5 h-1.5 rounded-full ${di < value - 4 ? 'bg-turf' : 'bg-slate-200'}`}
                                  />
                                ))}
                              </span>
                              Fútbol {value} ({capacities[value]} jugadores)
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage data-testid="match-modality-error" />
                  </FormItem>
                )}
              />

              <div className="rounded-2xl border border-turf/20 bg-mesh-turf bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-turf-accessible">
                  Capacidad
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="font-heading text-3xl font-bold leading-none text-slate-900 tabular-nums">
                    {capacities[parseInt(selectedModality, 10)]}
                  </span>
                  <span className="text-sm font-semibold text-slate-600">
                    titulares · Fútbol {selectedModality}
                  </span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Los que se anoten después del cupo quedan como suplentes. La inscripción cierra el día
                  del partido al mediodía.
                </p>
              </div>
            </Panel>

            <Panel
              icono={Gauge}
              titulo="¿Cómo se juega?"
              bajada="Qué le va a pedir la app al grupo cuando termine el partido."
              tono="slate"
              testId="create-match-modo"
              contentClassName="space-y-5 p-4 sm:p-5"
            >
              <FormField
                control={control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modo del partido</FormLabel>
                    <p className="mb-2.5 mt-0.5 text-xs leading-relaxed text-slate-600">
                      Viene del grupo. Cambialo sólo si esta fecha es distinta de
                      las demás.
                    </p>
                    <OptionCards
                      options={modes}
                      value={field.value}
                      onChange={field.onChange}
                      name="Modo del partido"
                      testId="match-mode"
                    />
                    <FormMessage data-testid="match-mode-error" />
                  </FormItem>
                )}
              />

              {types.length > 0 && (
                <FormField
                  control={control}
                  name="match_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de partido</FormLabel>
                      <p className="mb-2.5 mt-0.5 text-xs leading-relaxed text-slate-600">
                        Sirve para ver, más adelante, quién rinde parecido en los
                        dos y quién no.
                      </p>
                      <OptionCards
                        options={types}
                        value={field.value}
                        onChange={field.onChange}
                        columns={2}
                        name="Tipo de partido"
                        testId="match-type"
                      />
                      <FormMessage data-testid="match-type-error" />
                    </FormItem>
                  )}
                />
              )}

              {eligeEstadisticas && trackableStats.length > 0 && (
                <FormField
                  control={control}
                  name="tracked_stats"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>¿Qué estadísticas vas a seguir?</FormLabel>
                      <p className="mb-2.5 mt-0.5 text-xs leading-relaxed text-slate-600">
                        Cargar esto lleva tiempo cuando termina el partido. Tildá
                        sólo lo que de verdad vayas a completar.
                      </p>
                      <StatPicker
                        stats={trackableStats}
                        value={field.value}
                        onChange={field.onChange}
                        testId="match-tracked-stats"
                      />
                      {field.value?.length === 0 && (
                        <p
                          className="mt-2 text-xs text-slate-600"
                          data-testid="no-stats-notice"
                        >
                          Sin ninguna tildada el partido no va a pedir estadísticas.
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              )}

              {!modes.length && (
                <p className="text-sm text-slate-600" data-testid="modes-unavailable">
                  No pudimos cargar los modos. El partido se va a crear con el
                  modo que tenga configurado el grupo.
                </p>
              )}
            </Panel>

            <Panel
              icono={Clock}
              titulo="¿Cuándo?"
              bajada="Día y hora del encuentro."
              tono="turf"
              testId="create-match-cuando"
              contentClassName="space-y-4 p-4 sm:p-5"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                          className={FIELD}
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
                          className={FIELD}
                        />
                      </FormControl>
                      <FormMessage data-testid="match-time-error" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={control}
                name="is_recurring"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 space-y-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-turf/10 text-turf-accessible"
                      >
                        <Repeat className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <FormLabel className="font-semibold">Partido recurrente</FormLabel>
                        <p className="text-xs text-slate-600">Se repite semanalmente</p>
                      </div>
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
            </Panel>

            <Panel
              icono={MapPin}
              titulo="¿Dónde?"
              bajada="El nombre de la cancha y, si tenés, el link del mapa."
              tono="slate"
              testId="create-match-donde"
              contentClassName="space-y-4 p-4 sm:p-5"
            >
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
                        className={FIELD}
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
                        className={FIELD}
                      />
                    </FormControl>
                    <FormMessage data-testid="match-maps-error" />
                  </FormItem>
                )}
              />
            </Panel>

            {/* Barra de envío pegada al pie: en un formulario largo el botón no
                puede quedar a tres scrolls de distancia del campo que estás llenando. */}
            <div className="sticky bottom-3 z-10 rounded-3xl border border-slate-200/70 bg-white/85 p-3 shadow-lift backdrop-blur-md sm:bottom-4">
              <Button
                type="submit"
                data-testid="create-match-submit"
                disabled={loading || loadingGroups || groups.length === 0 || faltaElRival}
                shape="pill"
                className="w-full h-12 bg-turf-btn hover:bg-turf-btn-dark text-white shadow-lg shadow-turf/25 focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 disabled:active:scale-100"
              >
                <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                {loading ? 'Creando...' : 'Crear partido'}
              </Button>
              {!loadingGroups && groups.length === 0 && (
                <p className="mt-2 text-center text-xs text-slate-600">
                  Necesitás ser organizador de al menos un grupo para crear partidos.
                </p>
              )}
              {faltaElRival && (
                <p className="mt-2 text-center text-xs text-slate-600" data-testid="missing-opponent-hint">
                  Cargá contra quién juegan para poder crear el partido.
                </p>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
