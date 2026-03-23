import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateGroup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = form.name.trim();
    if (!name) {
      toast.error('Ingresa un nombre para el grupo');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/groups', { name });
      toast.success('Grupo creado!');
      navigate(`/partidos/crear?group_id=${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear grupo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-2xl mx-auto" data-testid="create-group-page">
      <div className="animate-slide-up">
        <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight mb-2">
          Crear Grupo
        </h1>
        <p className="text-slate-500 mb-8">
          Crea un grupo para organizar tus partidos y manejar jugadores frecuentes.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                <Users className="w-5 h-5 text-turf" /> Datos del grupo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="group-name">Nombre del grupo</Label>
                <Input
                  id="group-name"
                  data-testid="group-name-input"
                  placeholder="Ej: Futbol de los jueves"
                  value={form.name}
                  onChange={(e) => setForm({ name: e.target.value })}
                  className="mt-1.5 h-12 bg-slate-50"
                  maxLength={80}
                  required
                />
                <p className="text-xs text-slate-500 mt-2">
                  Al crear el grupo quedaras como organizador dentro de ese grupo.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-sm text-slate-600">
              Despues de crearlo te llevamos directo a <strong>Crear Partido</strong> con el grupo ya seleccionado.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              data-testid="create-group-submit"
              disabled={loading}
              className="bg-turf hover:bg-turf-dark text-white"
            >
              {loading ? 'Creando...' : 'Crear Grupo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}