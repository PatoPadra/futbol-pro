import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageLoader from '@/components/common/PageLoader';
import { tokenDe } from '@/lib/invitations';

/**
 * Entrar a un grupo con un link de invitacion.
 *
 * DOS MODOS EN UNA PANTALLA:
 *
 *   /invitacion/:token  el link que te pasaron. Muestra a que grupo es y quien
 *                       te invita, y te deja entrar de un toque.
 *   /unirme             pegar el link a mano. Existe porque la gente copia
 *                       links a lugares raros — un mail, un papel, un mensaje
 *                       que se corto — y quedarse afuera por eso seria absurdo.
 *
 * NADIE ENTRA A CIEGAS. La pantalla siempre dice el nombre del grupo, quien
 * invita y cuanta gente hay antes de que toques nada. Un link de invitacion es
 * una puerta, y una puerta sin cartel da desconfianza con razon.
 */

export default function JoinGroup() {
  const { token: tokenDeLaRuta } = useParams();
  const navigate = useNavigate();

  const [pegado, setPegado] = useState('');
  const [invitacion, setInvitacion] = useState(null);
  const [cargando, setCargando] = useState(Boolean(tokenDeLaRuta));
  const [error, setError] = useState(null);
  const [entrando, setEntrando] = useState(false);

  const mirar = useCallback(async (token) => {
    if (!token) return;
    setCargando(true);
    setError(null);
    try {
      const res = await api.get(`/invitations/${token}`);
      setInvitacion(res.data);
    } catch (err) {
      setInvitacion(null);
      setError(
        err.response?.status === 404
          ? 'Este link de invitación ya no sirve. Pedile uno nuevo al organizador.'
          : 'No pudimos abrir la invitación. Revisá tu conexión e intentá de nuevo.'
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (tokenDeLaRuta) mirar(tokenDeLaRuta);
  }, [tokenDeLaRuta, mirar]);

  const entrar = async () => {
    if (!invitacion) return;
    setEntrando(true);
    try {
      const res = await api.post(`/invitations/${invitacion.token}/accept`);
      toast.success(res.data.message);
      navigate(`/grupos/${res.data.group_id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos sumarte al grupo');
      setEntrando(false);
    }
  };

  if (cargando) return <div data-testid="join-loading"><PageLoader /></div>;

  return (
    <div className="page-container mx-auto max-w-xl" data-testid="join-group-page">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lift sm:p-8">
        <span
          aria-hidden="true"
          className="grid h-12 w-12 place-items-center rounded-2xl border border-turf/25 bg-turf/10 text-turf-accessible"
        >
          <Users className="h-6 w-6" />
        </span>

        {invitacion ? (
          <>
            <h1 className="mt-4 font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
              {invitacion.group_name}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {invitacion.invitado_por
                ? `${invitacion.invitado_por} te invita a su grupo.`
                : 'Te invitaron a este grupo.'}
              {invitacion.miembros > 0 && (
                <> Ya son {invitacion.miembros} {invitacion.miembros === 1 ? 'jugador' : 'jugadores'}.</>
              )}
            </p>

            {invitacion.ya_soy_miembro ? (
              <>
                <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  Ya sos parte de este grupo.
                </p>
                <Link to={`/grupos/${invitacion.group_id}`} className="mt-5 inline-block rounded-full focus-visible:outline-none">
                  <Button shape="pill" className="h-11 px-6" data-testid="join-go-to-group">
                    Ir al grupo
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm text-slate-600">
                  Vas a entrar como jugador del grupo. Después el organizador puede
                  darte más permisos si hace falta.
                </p>
                <Button
                  onClick={entrar}
                  disabled={entrando}
                  shape="pill"
                  className="mt-5 h-11 px-6"
                  data-testid="join-accept"
                >
                  {entrando
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Entrando...</>
                    : <>Entrar al grupo<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></>}
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <h1 className="mt-4 font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
              Entrar a un grupo
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Pegá acá el link que te pasaron. Sirve el link entero o sólo el código
              del final.
            </p>

            {error && (
              <p
                className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
                data-testid="join-error"
              >
                {error}
              </p>
            )}

            <form
              className="mt-5 flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                const token = tokenDe(pegado);
                if (!token) {
                  setError('Ese link no parece una invitación. Fijate que esté completo.');
                  return;
                }
                mirar(token);
              }}
            >
              <Input
                value={pegado}
                onChange={(e) => setPegado(e.target.value)}
                placeholder="https://... o el código"
                className="h-11 flex-1"
                data-testid="join-token-input"
                aria-label="Link de invitación"
              />
              <Button type="submit" shape="pill" className="h-11 px-6" data-testid="join-lookup">
                Ver el grupo
              </Button>
            </form>

            <p className="mt-6 text-sm text-slate-600">
              ¿No tenés link?{' '}
              <Link to="/grupos/crear" className="font-semibold text-turf-accessible underline underline-offset-2">
                Armá tu propio grupo
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
