import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import AuthLayout from '../components/auth/AuthLayout';
import { pickClips } from '../constants/media';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Ingresá tu email').email('Ingresá un email válido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

// Selección propia de esta pantalla (distinta a la del registro). Los tres
// duran más que el intervalo de rotación (18s / 23.3s / 12.2s): con clips de 7s
// el panel se reiniciaba a la vista antes de cambiar. Femenino y mixto incluidos.
const LOGIN_CLIPS = pickClips({ ids: [42540, 41372, 44602] });

export default function Login() {
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // A dónde iba antes de que lo mandaran a loguearse (lo guarda ProtectedRoute).
  const volviaA = location.state?.from?.pathname
    ? `${location.state.from.pathname}${location.state.from.search || ''}`
    : null;

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
      // Si venía de un link (una invitación, un partido compartido), vuelve ahí.
      // Sin perfil completo no: primero hay que terminar el alta.
      const destino = res.has_profile ? (volviaA || '/dashboard') : '/completar-perfil';
      navigate(destino, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.detail || 'No pudimos iniciar tu sesión. Revisá tu email y contraseña.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      testId="login-page"
      logoTestId="login-logo-link"
      clips={LOGIN_CLIPS}
      eyebrow="De vuelta a la cancha"
      editorialTitle="El partido del sábado no se arma solo"
      editorialCopy="Entrá y mirá quién se anotó, a quién hay que apurar y cómo quedaron los equipos de la última fecha."
      heading="Iniciar Sesión"
      subheading="Entrá con tu email y seguí donde dejaste."
    >
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
          shape="pill"
          data-testid="login-submit-btn"
          disabled={loading}
          className="w-full h-12 bg-turf-btn hover:bg-turf-btn-dark text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {loading ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </form>
      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
        ¿No tenés cuenta?{' '}
        <Link
          to="/registro"
          className="text-turf-accessible font-semibold hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
          data-testid="go-to-register"
        >
          Registrate
        </Link>
      </p>
    </AuthLayout>
  );
}
