import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form';

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

  const form = useForm({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/groups', { name: data.name.trim() });
      toast.success('¡Grupo creado!');
      navigate(`/partidos/crear?group_id=${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear grupo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-xl mx-auto" data-testid="create-group-page">
      <div className="animate-slide-up">
        <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight mb-2">Crear Grupo</h1>
        <p className="text-slate-500 mb-8">
          Solo organizadores y admins pueden crear grupos. Al terminar, te llevamos directo a crear el primer partido con el grupo preseleccionado.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate data-testid="create-group-form">
            <Card className="border-slate-100">
              <CardContent className="p-5 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Nombre del grupo <span className="text-orange">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="create-group-name-input"
                          placeholder="Ej: Fútbol de los jueves"
                          className="mt-1.5 h-12 bg-slate-50"
                          autoFocus
                        />
                      </FormControl>
                      <p className="text-xs text-slate-500">Lo van a ver todos los miembros del grupo, elegí un nombre claro.</p>
                      <FormMessage data-testid="create-group-name-error" />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Button
              type="submit"
              data-testid="create-group-submit"
              disabled={loading}
              shape="pill"
              className="w-full h-12 bg-turf hover:bg-turf-dark text-white shadow-lg shadow-turf/20 disabled:active:scale-100"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
              {loading ? 'Creando...' : 'Crear Grupo'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
