import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Trophy, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Ingresá tu email').email('Ingresá un email válido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

export default function Login() {
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      const res = await login(data.email, data.password);
      toast.success('¡Bienvenido de nuevo!');
      navigate(res.has_profile ? '/dashboard' : '/completar-perfil');
    } catch (err) {
      const msg = err.response?.data?.detail || 'No pudimos iniciar tu sesión. Revisá tu email y contraseña.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background px-4 py-12"
      style={{ backgroundImage: 'radial-gradient(at 0% 0%, hsla(145,63%,42%,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(25,95%,53%,0.10) 0px, transparent 50%)' }}
      data-testid="login-page"
    >
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex justify-center mb-8">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
            data-testid="login-logo-link"
          >
            <div className="w-10 h-10 bg-turf rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <span className="font-heading text-2xl font-bold uppercase tracking-tight">App Futbol</span>
          </Link>
        </div>

        <Card className="border-slate-100 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="font-heading text-2xl uppercase tracking-tight text-center">Iniciar Sesión</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div
                className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                role="alert"
                aria-live="polite"
                data-testid="login-error"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  data-testid="login-email-input"
                  placeholder="tu@email.com"
                  disabled={loading}
                  aria-invalid={!!errors.email}
                  className={`mt-1.5 h-12 bg-slate-50 ${errors.email ? 'border-red-300' : 'border-slate-200'}`}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600" data-testid="login-email-error">{errors.email.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    data-testid="login-password-input"
                    placeholder="Tu contraseña"
                    disabled={loading}
                    aria-invalid={!!errors.password}
                    className={`h-12 bg-slate-50 pr-12 ${errors.password ? 'border-red-300' : 'border-slate-200'}`}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    disabled={loading}
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                    data-testid="toggle-password"
                    aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPw}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600" data-testid="login-password-error">{errors.password.message}</p>
                )}
              </div>
              <Button
                type="submit"
                data-testid="login-submit-btn"
                disabled={loading}
                className="w-full h-12 bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase tracking-wider text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {loading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">
              ¿No tenés cuenta?{' '}
              <Link
                to="/registro"
                className="text-turf-accessible font-semibold hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                data-testid="go-to-register"
              >
                Registrate
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
