import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Camera, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CompleteProfile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [positions, setPositions] = useState([]);
  const [form, setForm] = useState({
    name: user?.name || '',
    birth_date: '',
    primary_position: '',
    secondary_positions: [],
    unwanted_position: '',
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/positions').then(res => setPositions(res.data)).catch(() => {});
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const toggleSecondary = (posId) => {
    setForm(prev => {
      const current = prev.secondary_positions;
      if (current.includes(posId)) {
        return { ...prev, secondary_positions: current.filter(p => p !== posId) };
      }
      if (current.length >= 3) {
        toast.error('Maximo 3 posiciones secundarias');
        return prev;
      }
      if (posId === prev.primary_position) return prev;
      return { ...prev, secondary_positions: [...current, posId] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.primary_position) {
      toast.error('Selecciona tu posicion principal');
      return;
    }
    if (!form.birth_date) {
      toast.error('Ingresa tu fecha de nacimiento');
      return;
    }
    setLoading(true);
    try {
      if (photo) {
        const fd = new FormData();
        fd.append('file', photo);
        await api.post('/profile/photo', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      await api.put('/profile', form);
      updateUser({ has_profile: true });
      toast.success('Perfil completado!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-2xl mx-auto" data-testid="complete-profile-page">
      <div className="animate-slide-up">
        <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">
          Completa tu perfil
        </h1>
        <p className="mt-2 text-slate-500">Necesitamos algunos datos para armar equipos equilibrados.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* Photo */}
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase">Foto de perfil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <label className="cursor-pointer group" data-testid="photo-upload-area">
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 group-hover:border-turf flex items-center justify-center overflow-hidden transition-colors">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-slate-400 group-hover:text-turf transition-colors" />
                    )}
                  </div>
                </label>
                <div className="text-sm text-slate-500">
                  <p className="font-medium text-slate-700">Subi tu foto</p>
                  <p>Ayuda a que tus companeros te reconozcan en la cancha.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase">Datos basicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  data-testid="profile-name-input"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1.5 h-12 bg-slate-50"
                  required
                />
              </div>
              <div>
                <Label htmlFor="birth_date">Fecha de nacimiento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  data-testid="profile-birthdate-input"
                  value={form.birth_date}
                  onChange={(e) => setForm(prev => ({ ...prev, birth_date: e.target.value }))}
                  className="mt-1.5 h-12 bg-slate-50"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Positions */}
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg uppercase">Posiciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Posicion principal</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {positions.map(p => (
                    <Badge
                      key={p.id}
                      data-testid={`primary-pos-${p.id}`}
                      variant={form.primary_position === p.id ? 'default' : 'outline'}
                      className={`cursor-pointer text-sm py-1.5 px-3 transition-all ${
                        form.primary_position === p.id
                          ? 'bg-turf text-white hover:bg-turf-dark border-turf'
                          : 'hover:border-turf hover:text-turf'
                      }`}
                      onClick={() => setForm(prev => ({
                        ...prev,
                        primary_position: p.id,
                        secondary_positions: prev.secondary_positions.filter(s => s !== p.id),
                      }))}
                    >
                      {form.primary_position === p.id && <Check className="w-3 h-3 mr-1" />}
                      {p.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Posiciones secundarias (max 3)</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {positions.filter(p => p.id !== form.primary_position).map(p => (
                    <Badge
                      key={p.id}
                      data-testid={`secondary-pos-${p.id}`}
                      variant={form.secondary_positions.includes(p.id) ? 'default' : 'outline'}
                      className={`cursor-pointer text-sm py-1.5 px-3 transition-all ${
                        form.secondary_positions.includes(p.id)
                          ? 'bg-slate-800 text-white hover:bg-slate-700'
                          : 'hover:border-slate-400'
                      }`}
                      onClick={() => toggleSecondary(p.id)}
                    >
                      {p.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Posicion no deseada (opcional)</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {positions.map(p => (
                    <Badge
                      key={p.id}
                      data-testid={`unwanted-pos-${p.id}`}
                      variant={form.unwanted_position === p.id ? 'destructive' : 'outline'}
                      className={`cursor-pointer text-sm py-1.5 px-3 transition-all ${
                        form.unwanted_position === p.id
                          ? ''
                          : 'hover:border-red-300 hover:text-red-600'
                      }`}
                      onClick={() => setForm(prev => ({
                        ...prev,
                        unwanted_position: prev.unwanted_position === p.id ? '' : p.id,
                      }))}
                    >
                      {form.unwanted_position === p.id && <X className="w-3 h-3 mr-1" />}
                      {p.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            data-testid="save-profile-btn"
            disabled={loading}
            className="w-full h-12 bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase tracking-wider"
          >
            {loading ? 'Guardando...' : 'Guardar y Continuar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
