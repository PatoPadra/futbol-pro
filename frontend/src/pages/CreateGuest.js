import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Slider } from '../components/ui/slider';
import { Check, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateGuest() {
  const navigate = useNavigate();
  const [positions, setPositions] = useState([]);
  const [form, setForm] = useState({ name: '', primary_position: '', estimated_level: 5 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/positions').then(res => setPositions(res.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/players/guest', {
        ...form,
        primary_position: form.primary_position || null,
      });
      toast.success('Jugador invitado creado!');
      navigate(-1);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally { setLoading(false); }
  };

  return (
    <div className="page-container max-w-lg mx-auto" data-testid="create-guest-page">
      <div className="animate-slide-up">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mb-2">Invitar Jugador</h1>
        <p className="text-slate-500 mb-8">Crea un perfil para un invitado que no tiene cuenta.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-slate-100">
            <CardContent className="p-5 space-y-4">
              <div>
                <Label>Nombre del invitado</Label>
                <Input
                  data-testid="guest-name-input"
                  placeholder="Nombre del jugador"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="mt-1.5 h-12 bg-slate-50"
                  required
                />
              </div>

              <div>
                <Label>Posicion estimada (opcional)</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {positions.map(p => (
                    <Badge
                      key={p.id}
                      data-testid={`guest-pos-${p.id}`}
                      variant={form.primary_position === p.id ? 'default' : 'outline'}
                      className={`cursor-pointer text-sm py-1.5 px-3 transition-all ${
                        form.primary_position === p.id ? 'bg-turf text-white border-turf' : 'hover:border-turf hover:text-turf'
                      }`}
                      onClick={() => setForm(p2 => ({ ...p2, primary_position: p2.primary_position === p.id ? '' : p.id }))}
                    >
                      {form.primary_position === p.id && <Check className="w-3 h-3 mr-1" />}
                      {p.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Nivel estimado: {form.estimated_level}</Label>
                <Slider
                  data-testid="guest-level-slider"
                  min={1}
                  max={10}
                  step={0.5}
                  value={[form.estimated_level]}
                  onValueChange={v => setForm(p => ({ ...p, estimated_level: v[0] }))}
                  className="mt-3"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>Principiante</span>
                  <span>Experto</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            data-testid="create-guest-submit"
            disabled={loading}
            className="w-full h-12 bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase tracking-wider"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {loading ? 'Creando...' : 'Crear Invitado'}
          </Button>
        </form>
      </div>
    </div>
  );
}
