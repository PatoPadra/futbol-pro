import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { toast } from 'sonner';

import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function CreateGroup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/groups', { name: name.trim() });
      toast.success('Grupo creado');
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
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mb-2">Crear Grupo</h1>
        <p className="text-slate-500 mb-8">
          Solo organizadores y admins pueden crear grupos. Al terminar, te llevamos directo a crear el primer partido con el grupo preseleccionado.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-slate-100">
            <CardContent className="p-5 space-y-4">
              <div>
                <Label>Nombre del grupo</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Futbol de los jueves"
                  className="mt-1.5 h-12 bg-slate-50"
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase tracking-wider"
          >
            <Users className="w-4 h-4 mr-2" />
            {loading ? 'Creando...' : 'Crear Grupo'}
          </Button>
        </form>
      </div>
    </div>
  );
}
