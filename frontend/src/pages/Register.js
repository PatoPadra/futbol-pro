import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Trophy, Eye, EyeOff, Loader2, MailCheck, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá tu nombre completo'),
  email: z.string().trim().min(1, 'Ingresá tu email').email('Ingresá un email válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export default function Register() {
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/register', data);

      setSuccessInfo({
        email: data.email,
        verificationRequired: res.data?.verification_required !== false,
        verificationSent: res.data?.verification_sent !== false,
        linkedGuestHistory: Boolean(res.data?.linked_guest_history),
      });

      toast.success('¡Cuenta creada!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos crear tu cuenta. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!successInfo) return;
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: successInfo.email });
      toast.success('Te reenviamos el email de verificación.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos reenviar el email. Intentá más tarde.');
    } finally {
      setResending(false);
    }
  };

  if (successInfo) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background px-4 py-12"
        style={{ backgroundImage: 'radial-gradient(at 0% 0%, hsla(145,63%,42%,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(25,95%,53%,0.10) 0px, transparent 50%)' }}
        data-testid="register-success-page"
      >
        <div className="w-full max-w-md animate-slide-up">
          <div className="flex justify-center mb-8">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
              data-testid="register-success-logo-link"
            >
              <div className="w-10 h-10 bg-turf rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <span className="font-heading text-2xl font-bold uppercase tracking-tight">App Futbol</span>
            </Link>
          </div>

          <Card className="border-slate-100 shadow-md">
            <CardHeader className="pb-2 items-center">
              <div className="w-14 h-14 rounded-full bg-turf/10 flex items-center justify-center mb-2">
                <MailCheck className="w-7 h-7 text-turf-accessible" />
              </div>
              <CardTitle className="font-heading text-2xl uppercase tracking-tight text-center">
                {successInfo.verificationRequired ? 'Revisá tu email' : '¡Cuenta creada!'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-slate-700">
                Creamos tu cuenta para <strong>{successInfo.email}</strong>.
              </p>

              {successInfo.linkedGuestHistory && (
                <div
                  className="flex items-start gap-2 rounded-lg border border-turf/30 bg-turf/5 px-3 py-2.5 text-left text-sm text-slate-700"
                  data-testid="linked-guest-history-notice"
                >
                  <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-turf-accessible" />
                  <span>
                    Encontramos tu historial como invitado (partidos y calificaciones) y ya lo vinculamos a tu cuenta nueva.
                  </span>
                </div>
              )}

              {!successInfo.verificationRequired ? (
                <p className="text-slate-600">
                  Ya podés iniciar sesión.
                </p>
              ) : successInfo.verificationSent ? (
                <p className="text-slate-600">
                  Te enviamos un link para verificarla. Después de eso ya vas a poder iniciar sesión.
                </p>
              ) : (
                <div
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-sm text-amber-800"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    La cuenta fue creada, pero no pudimos enviarte el email de verificación automáticamente.
                    Probá reenviarlo en unos minutos.
                  </span>
                </div>
              )}

              {successInfo.verificationRequired && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResend}
                  disabled={resending}
                  data-testid="resend-verification-btn"
                  className="w-full h-12 border-2 border-slate-200 text-slate-800 rounded-xl font-bold uppercase tracking-wider text-sm hover:border-turf hover:text-turf-accessible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                >
                  {resending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  {resending ? 'Reenviando...' : 'Reenviar email de verificación'}
                </Button>
              )}

              <Button asChild data-testid="register-success-login-btn" className="w-full h-12 bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase tracking-wider text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2">
                <Link to="/login">Ir a iniciar sesión</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background px-4 py-12"
      style={{ backgroundImage: 'radial-gradient(at 0% 0%, hsla(145,63%,42%,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(25,95%,53%,0.10) 0px, transparent 50%)' }}
      data-testid="register-page"
    >
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex justify-center mb-8">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
            data-testid="register-logo-link"
          >
            <div className="w-10 h-10 bg-turf rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <span className="font-heading text-2xl font-bold uppercase tracking-tight">App Futbol</span>
          </Link>
        </div>

        <Card className="border-slate-100 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="font-heading text-2xl uppercase tracking-tight text-center">Crear Cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="name">Nombre completo</Label>
                <Input
                  id="name"
                  data-testid="register-name-input"
                  placeholder="Juan Pérez"
                  disabled={loading}
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  className={`mt-1.5 h-12 bg-slate-50 ${errors.name ? 'border-red-300' : 'border-slate-200'}`}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600" data-testid="register-name-error">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="register-email-input"
                  placeholder="tu@email.com"
                  disabled={loading}
                  autoComplete="email"
                  inputMode="email"
                  aria-invalid={!!errors.email}
                  className={`mt-1.5 h-12 bg-slate-50 ${errors.email ? 'border-red-300' : 'border-slate-200'}`}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600" data-testid="register-email-error">{errors.email.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    data-testid="register-password-input"
                    placeholder="Tu contraseña"
                    disabled={loading}
                    autoComplete="new-password"
                    aria-invalid={!!errors.password}
                    className={`h-12 bg-slate-50 pr-12 ${errors.password ? 'border-red-300' : 'border-slate-200'}`}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    disabled={loading}
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                    data-testid="toggle-register-password"
                    aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPw}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password ? (
                  <p className="mt-1 text-xs text-red-600" data-testid="register-password-error">{errors.password.message}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Mínimo 6 caracteres</p>
                )}
              </div>
              <Button
                type="submit"
                data-testid="register-submit-btn"
                disabled={loading}
                className="w-full h-12 bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase tracking-wider text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {loading ? 'Creando cuenta...' : 'Registrarme'}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">
              ¿Ya tenés cuenta?{' '}
              <Link
                to="/login"
                className="text-turf-accessible font-semibold hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                data-testid="go-to-login"
              >
                Iniciar sesión
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
