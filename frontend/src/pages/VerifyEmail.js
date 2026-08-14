import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Trophy, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verificando tu cuenta...');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Falta el token de verificación. Revisá que el link esté completo.');
        return;
      }

      try {
        const res = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        setStatus('success');
        setMessage(res.data?.message || 'Cuenta verificada correctamente');
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'No se pudo verificar la cuenta');
      }
    };

    run();
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: resendEmail });
      setResendDone(true);
      toast.success('Te reenviamos el email de verificación.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos reenviar el email. Intentá más tarde.');
    } finally {
      setResending(false);
    }
  };

  const statusConfig = {
    loading: {
      title: 'Verificando...',
      icon: <Loader2 className="w-7 h-7 text-turf-accessible animate-spin" aria-hidden="true" />,
      iconBg: 'bg-turf/10',
      textClass: 'text-slate-700',
    },
    success: {
      title: 'Cuenta verificada',
      icon: <CheckCircle2 className="w-7 h-7 text-white animate-in zoom-in duration-300" aria-hidden="true" />,
      iconBg: 'bg-turf',
      textClass: 'text-slate-700',
    },
    error: {
      title: 'Error de verificación',
      icon: <XCircle className="w-7 h-7 text-red-600" aria-hidden="true" />,
      iconBg: 'bg-red-50',
      textClass: 'text-red-600',
    },
  }[status];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12" data-testid="verify-email-page">
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex justify-center mb-8">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
            data-testid="verify-email-logo-link"
          >
            <div className="w-10 h-10 bg-turf rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <span className="font-heading text-2xl font-bold uppercase tracking-tight">App Futbol</span>
          </Link>
        </div>

        <Card className="border-slate-100 shadow-lg">
          <CardHeader className="pb-2 items-center">
            <div className={`w-14 h-14 rounded-full ${statusConfig.iconBg} flex items-center justify-center mb-2`}>
              {statusConfig.icon}
            </div>
            <CardTitle className="font-heading text-2xl uppercase tracking-tight text-center">
              {statusConfig.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className={statusConfig.textClass} role="status" aria-live="polite" data-testid="verify-email-message">
              {message}
            </p>

            {status === 'error' && !resendDone && (
              <form onSubmit={handleResend} className="space-y-3 text-left" data-testid="resend-verification-form" noValidate>
                <div>
                  <Label htmlFor="resend-email">¿Necesitás un nuevo link?</Label>
                  <Input
                    id="resend-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="tu@email.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    disabled={resending}
                    data-testid="resend-email-input"
                    className="mt-1.5 h-12 bg-slate-50 border-slate-200 focus:border-turf focus-visible:ring-2 focus-visible:ring-turf/30"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={resending}
                  data-testid="resend-verification-submit-btn"
                  shape="pill"
                  className="w-full h-12 bg-turf hover:bg-turf-dark text-white"
                >
                  {resending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  {resending ? 'Reenviando...' : 'Reenviar email de verificación'}
                </Button>
              </form>
            )}

            {status === 'error' && resendDone && (
              <p className="text-sm text-turf-accessible font-medium" data-testid="resend-verification-success">
                Listo, revisá tu bandeja de entrada.
              </p>
            )}

            <Button
              asChild
              data-testid="verify-email-login-btn"
              shape="pill"
              className={
                status === 'error' && !resendDone
                  ? 'w-full h-12 bg-white border-2 border-slate-200 text-slate-800 hover:border-slate-800 hover:text-slate-900'
                  : 'w-full h-12 bg-turf hover:bg-turf-dark text-white'
              }
            >
              <Link to="/login">Ir a iniciar sesión</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
