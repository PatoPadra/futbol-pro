import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Trophy, Loader2, CheckCircle2, XCircle, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import PhotoBackdrop from '@/components/media/PhotoBackdrop';
import { fotoDePagina } from '@/constants/fotos';

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

  /**
   * Cada estado tiene que leerse de un saque, sin comparar tonos: cambia el
   * glifo, el color de la barra de arriba de la tarjeta y la linea de contexto.
   * Si alguien no separa rojo de verde, la forma del icono y el texto del
   * eyebrow ya dicen lo mismo.
   */
  const statusConfig = {
    loading: {
      title: 'Verificando...',
      eyebrow: 'Un segundo',
      icon: <Loader2 className="w-7 h-7 text-turf-accessible animate-spin motion-reduce:animate-none" aria-hidden="true" />,
      iconBg: 'bg-turf/10',
      textClass: 'text-slate-700',
      barra: 'bg-slate-200',
      anillo: 'ring-1 ring-turf/25',
    },
    success: {
      title: 'Cuenta verificada',
      eyebrow: 'Ya estás adentro',
      icon: <CheckCircle2 className="w-7 h-7 text-white animate-in zoom-in duration-300" aria-hidden="true" />,
      iconBg: 'bg-turf',
      textClass: 'text-slate-700',
      barra: 'bg-turf',
      anillo: 'ring-4 ring-turf/20',
    },
    error: {
      title: 'Error de verificación',
      eyebrow: 'No pudimos verificarte',
      icon: <XCircle className="w-7 h-7 text-red-600" aria-hidden="true" />,
      iconBg: 'bg-red-50',
      textClass: 'text-red-700',
      barra: 'bg-red-500',
      anillo: 'ring-1 ring-red-200',
    },
  }[status];

  const foto = fotoDePagina('verificar');

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50 lg:grid lg:grid-cols-[1.05fr_1fr] lg:items-stretch"
      data-testid="verify-email-page"
    >
      {/* Panel de foto: franja corta en mobile, columna completa en desktop.
          El formulario nunca queda dentro de un contenedor de alto fijo, asi que
          cuando se abre el teclado la pagina scrollea y no se recorta nada. */}
      <PhotoBackdrop
        foto={foto}
        scrim="panel"
        priority
        posicion="50% 40%"
        className="h-40 shrink-0 sm:h-52 lg:sticky lg:top-0 lg:h-screen"
      >
        <div className="flex h-full flex-col justify-between p-5 sm:p-6 lg:p-12 xl:p-16">
          <Link
            to="/"
            className="flex w-fit items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            data-testid="verify-email-logo-link"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-turf shadow-lg shadow-turf/25">
              <Trophy className="h-6 w-6 text-white" aria-hidden="true" />
            </span>
            <span className="font-heading text-2xl font-bold uppercase tracking-tight text-white [text-shadow:0_1px_10px_rgba(2,6,23,0.7)]">
              App Futbol
            </span>
          </Link>

          <div className="max-w-lg">
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.22em] text-turf-light [text-shadow:0_1px_10px_rgba(2,6,23,0.7)] sm:text-sm">
              Bienvenido
            </p>
            <p className="mt-3 hidden font-heading text-4xl uppercase leading-[0.95] tracking-tight text-white lg:block xl:text-5xl">
              Un paso y estás en la cancha
            </p>
            <p className="mt-4 hidden max-w-md font-body text-base leading-relaxed text-slate-200 lg:block">
              Confirmamos tu email para que nadie te anote una fecha por vos. Después de esto, ya
              podés sumarte a los partidos de tu grupo.
            </p>
          </div>
        </div>
      </PhotoBackdrop>

      {/* Columna de contenido: superficie clara, para que el rojo del error y los
          textos de ayuda mantengan su contraste. */}
      <main className="flex flex-1 items-start justify-center bg-slate-50 bg-mesh-turf px-4 py-8 sm:px-6 sm:py-12 lg:items-center lg:px-10 lg:py-16">
        <div className="w-full max-w-md animate-slide-up motion-reduce:animate-none">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lift">
            {/* Barra de estado: el primer indicio de en que estado estamos. */}
            <div aria-hidden="true" className={`h-1.5 w-full ${statusConfig.barra}`} />

            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-center text-center">
                <div
                  className={`mb-3 flex h-14 w-14 items-center justify-center rounded-full ${statusConfig.iconBg} ${statusConfig.anillo}`}
                >
                  {statusConfig.icon}
                </div>

                <p className="font-heading text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  {statusConfig.eyebrow}
                </p>

                <h1 className="mt-1 font-heading text-2xl font-bold uppercase tracking-tight text-slate-900">
                  {statusConfig.title}
                </h1>

                <p
                  className={`mt-3 text-sm leading-relaxed ${statusConfig.textClass}`}
                  role="status"
                  aria-live="polite"
                  data-testid="verify-email-message"
                >
                  {message}
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {status === 'error' && !resendDone && (
                  <form
                    onSubmit={handleResend}
                    className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-left"
                    data-testid="resend-verification-form"
                    noValidate
                  >
                    <div>
                      <Label htmlFor="resend-email" className="text-sm font-semibold text-slate-800">
                        ¿Necesitás un nuevo link?
                      </Label>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                        Poné tu email y te mandamos otro. Los links vencen, así que usá el último.
                      </p>
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
                        className="mt-2 h-12 rounded-xl border-slate-200 bg-white placeholder:text-slate-500 focus:border-turf focus-visible:ring-2 focus-visible:ring-turf/30"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={resending}
                      data-testid="resend-verification-submit-btn"
                      shape="pill"
                      className="h-12 w-full bg-turf text-white hover:bg-turf-dark"
                    >
                      {resending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      {resending ? 'Reenviando...' : 'Reenviar email de verificación'}
                    </Button>
                  </form>
                )}

                {status === 'error' && resendDone && (
                  <p
                    className="flex items-center justify-center gap-2 rounded-xl border border-turf/25 bg-turf/10 px-4 py-3 text-sm font-semibold text-turf-accessible"
                    data-testid="resend-verification-success"
                  >
                    <MailCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Listo, revisá tu bandeja de entrada.
                  </p>
                )}

                <Button
                  asChild
                  data-testid="verify-email-login-btn"
                  shape="pill"
                  className={
                    status === 'error' && !resendDone
                      ? 'h-12 w-full border-2 border-slate-300 bg-white text-slate-800 hover:border-slate-800 hover:bg-white hover:text-slate-900'
                      : 'h-12 w-full bg-turf text-white hover:bg-turf-dark'
                  }
                >
                  <Link to="/login">Ir a iniciar sesión</Link>
                </Button>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
            Si el link no funciona, copialo completo del email: a veces se corta en dos líneas.
          </p>
        </div>
      </main>
    </div>
  );
}
