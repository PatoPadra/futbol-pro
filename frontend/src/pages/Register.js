import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Trophy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('La contrasena debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success('Cuenta creada!');
      navigate('/completar-perfil');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12" data-testid="register-page">
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-turf rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <span className="font-heading text-2xl font-bold uppercase tracking-tight">App Futbol</span>
          </Link>
        </div>

        <Card className="border-slate-100 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="font-heading text-2xl uppercase tracking-tight text-center">Crear Cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre completo</Label>
                <Input
                  id="name"
                  data-testid="register-name-input"
                  placeholder="Juan Perez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 h-12 bg-slate-50 border-slate-200 focus:border-turf"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="register-email-input"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 h-12 bg-slate-50 border-slate-200 focus:border-turf"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Contrasena</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    data-testid="register-password-input"
                    placeholder="Minimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-slate-50 border-slate-200 focus:border-turf pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                data-testid="register-submit-btn"
                disabled={loading}
                className="w-full h-12 bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase tracking-wider text-sm"
              >
                {loading ? 'Creando cuenta...' : 'Registrarme'}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">
              Ya tenes cuenta?{' '}
              <Link to="/login" className="text-turf font-semibold hover:underline" data-testid="go-to-login">
                Iniciar sesion
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
