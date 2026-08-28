import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Gauge, Users, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form';
import PageHeader from '../components/common/PageHeader';
import SectionPanel from '../components/groups/SectionPanel';
import OptionCards from '@/components/matches/OptionCards';
import useMatchCatalogs from '@/hooks/use-match-catalogs';

const groupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(60, 'El nombre es demasiado largo'),
});

export default function CreateGroup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { modes, defaultMode } = useMatchCatalogs();
  const [modo, setModo] = useState('');

  const form = useForm({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: '' },
  });

  // El default sale del catálogo del backend y no de un literal acá: si mañana
  // cambia cuál es el modo de arranque, cambia en un solo lado.
  useEffect(() => {
    if (defaultMode && !modo) setModo(defaultMode);
  }, [defaultMode, modo]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/groups', {
        name: data.name.trim(),
        // Sin modo elegido no se manda: el backend pone el suyo.
        ...(modo ? { default_match_mode: modo } : {}),
      });
      toast.success('¡Grupo creado!');
      // Al grupo, no a crear partido. Crear el partido primero deja un grupo de
      // una sola persona donde nadie se puede anotar: lo urgente despues de
      // armar el grupo es sumar a la gente, y ahi esta el link.
      navigate(`/grupos/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear grupo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container mx-auto max-w-xl" data-testid="create-group-page">
      <div className="animate-slide-up space-y-6">
        <PageHeader
          slug="crear-grupo"
          eyebrow="Nuevo grupo"
          titulo="Crear grupo"
          bajada="Un nombre y listo. Después le sumás la gente."
          volverA="/dashboard"
          volverLabel="Inicio"
          icono={Users}
          testId="create-group-header"
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate data-testid="create-group-form">
            <SectionPanel icono={Sparkles} titulo="¿Cómo se llama?">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Nombre del grupo <span className="text-orange-accessible">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="create-group-name-input"
                        placeholder="Ej: Fútbol de los jueves"
                        className="mt-1.5 h-12 rounded-xl bg-slate-50"
                        autoFocus
                      />
                    </FormControl>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Lo van a ver todos los miembros del grupo, elegí un nombre claro.
                    </p>
                    <FormMessage data-testid="create-group-name-error" />
                  </FormItem>
                )}
              />
            </SectionPanel>

            {modes.length > 0 && (
              <SectionPanel
                icono={Gauge}
                titulo="¿Cómo juegan?"
                descripcion="Con qué configuración van a arrancar los partidos de este grupo. Se puede cambiar después, y cada partido lo puede pisar."
                testId="create-group-mode-panel"
              >
                <OptionCards
                  options={modes}
                  value={modo}
                  onChange={setModo}
                  name="Modo de los partidos"
                  testId="create-group-mode"
                />
              </SectionPanel>
            )}

            <Button
              type="submit"
              data-testid="create-group-submit"
              disabled={loading}
              shape="pill"
              className="h-12 w-full bg-turf-btn text-white shadow-lg shadow-turf/20 hover:bg-turf-btn-dark disabled:active:scale-100"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
              {loading ? 'Creando...' : 'Crear grupo'}
            </Button>

            <p className="text-center text-xs leading-relaxed text-slate-600">
              Cualquiera puede crear un grupo: al crearlo quedás como organizador y podés sumar al
              resto con un link, sin que nadie te habilite. Cuando termines te llevamos derecho a
              crear el primer partido, con el grupo ya elegido.
            </p>
          </form>
        </Form>
      </div>
    </div>
  );
}
