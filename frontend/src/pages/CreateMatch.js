import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

export default function CreateMatch() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({
    group_id: '',
    title: '',
    modality: '5',
    date: '',
    time: '',
    location: '',
    maps_link: '',
    is_recurring: false,
  });

  const capacities = { 5: 10, 6: 12, 7: 14, 8: 16, 9: 18, 10: 20, 11: 22 };

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const res = await api.get('/groups');
        const organizerGroups = (res.data || []).filter(
          g => g.my_member_role === 'organizador' || g.my_member_role === 'admin'
        );

        setGroups(organizerGroups);

        if (organizerGroups.length === 1) {
          setForm(prev => ({ ...prev, group_id: organizerGroups[0].id }));
        }
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Error al cargar grupos');
      } finally {
        setLoadingGroups(false);
      }
    };

    loadGroups();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.group_id) {
      toast.error('Selecciona un grupo');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        modality: parseInt(form.modality, 10),
      };

      const res = await api.post('/matches', payload);
      toast.success('Partido creado!');
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
        <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight mb-2">
          Crear Partido
        </h1>
        <p className="text-slate-500 mb-8">Configura los detalles del partido.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Grupo</Label>
                <Select
                  value={form.group_id}
                  onValueChange={v => setForm(p => ({ ...p, group_id: v }))}
                  disabled={loadingGroups || groups.length === 0}
                >
                  <SelectTrigger className="mt-1.5 h-12 bg-slate-50" data-testid="match-group-select">
                    <SelectValue placeholder={loadingGroups ? 'Cargando grupos...' : 'Selecciona un grupo'} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(group => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!loadingGroups && groups.length === 0 && (
                  <p className="text-xs text-red-500 mt-2">
                    No tienes grupos donde puedas crear partidos.
                  </p>
                )}
              </div>

              <div>
                <Label>Titulo del partido</Label>
                <Input
                  data-testid="match-title-input"
                  placeholder="Ej: Partido del sabado"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="mt-1.5 h-12 bg-slate-50"
                  required
                />
              </div>

              <div>
                <Label>Modalidad</Label>
                <Select
                  value={form.modality}
                  onValueChange={v => setForm(p => ({ ...p, modality: v }))}
                >
                  <SelectTrigger className="mt-1.5 h-12 bg-slate-50" data-testid="match-modality-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 6, 7, 8, 9, 10, 11].map(n => (
                      <SelectItem key={n} value={String(n)}>
                        Futbol {n} ({capacities[n]} jugadores)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    data-testid="match-date-input"
                    value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="mt-1.5 h-12 bg-slate-50"
                    required
                  />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    data-testid="match-time-input"
                    value={form.time}
                    onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                    className="mt-1.5 h-12 bg-slate-50"
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Lugar</Label>
                <Input
                  data-testid="match-location-input"
                  placeholder="Ej: Cancha Municipal"
                  value={form.location}
                  onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                  className="mt-1.5 h-12 bg-slate-50"
                  required
                />
              </div>

              <div>
                <Label>Link de ubicacion (opcional)</Label>
                <Input
                  data-testid="match-maps-input"
                  placeholder="https://maps.google.com/..."
                  value={form.maps_link}
                  onChange={e => setForm(p => ({ ...p, maps_link: e.target.value }))}
                  className="mt-1.5 h-12 bg-slate-50"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-medium">Partido recurrente</Label>
                  <p className="text-xs text-slate-500">Se repite semanalmente</p>
                </div>
                <Switch
                  checked={form.is_recurring}
                  onCheckedChange={v => setForm(p => ({ ...p, is_recurring: v }))}
                  data-testid="match-recurring-switch"
                />
              </div>
            </CardContent>
          </Card>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-sm text-slate-600">
              <strong>Capacidad:</strong> {capacities[parseInt(form.modality, 10)]} titulares (Futbol {form.modality}).
              Los jugadores que se anoten luego del cupo quedaran como suplentes.
              El cierre de inscripcion sera el dia del partido al mediodia.
            </p>
          </div>

          <Button
            type="submit"
            data-testid="create-match-submit"
            disabled={loading || loadingGroups || groups.length === 0}
            className="w-full h-12 bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase tracking-wider"
          >
            {loading ? 'Creando...' : 'Crear Partido'}
          </Button>
        </form>
      </div>
    </div>
  );
}