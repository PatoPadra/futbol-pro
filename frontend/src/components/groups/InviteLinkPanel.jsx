import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, Loader2, RefreshCw, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import SectionPanel from '@/components/groups/SectionPanel';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';

/**
 * El link con el que se suma gente al grupo.
 *
 * Antes la unica forma de entrar a un grupo era que el organizador te agregara
 * a mano buscandote por email, lo que dejaba afuera a cualquiera que no
 * estuviera ya en la base — y obligaba al organizador a pedir el mail uno por
 * uno. El link es el mismo gesto con el que ya se comparte el partido por
 * WhatsApp.
 *
 * UN SOLO LINK VIVO. Rotar mata el anterior, que es lo que se quiere cuando se
 * filtro. Tener varios activos suena flexible y en la practica solo hace
 * imposible contestar "quien tiene acceso".
 *
 * Quien entra por el link entra como jugador comun, nunca como organizador: eso
 * lo garantiza el backend y se dice aca para que el organizador sepa que esta
 * repartiendo.
 */
export default function InviteLinkPanel({ groupId, groupName }) {
  const [link, setLink] = useState(null);
  const [usos, setUsos] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [pendiente, setPendiente] = useState(null);

  const urlDe = (token) => `${window.location.origin}/invitacion/${token}`;

  const cargar = useCallback(async () => {
    try {
      const res = await api.get(`/groups/${groupId}/invite-link`);
      setLink(res.data.token);
      setUsos(res.data.usos || 0);
    } catch {
      setLink(null);
    } finally {
      setCargando(false);
    }
  }, [groupId]);

  useEffect(() => { cargar(); }, [cargar]);

  const generar = async ({ rotar = false } = {}) => {
    setTrabajando(true);
    setPendiente(null);
    try {
      const res = await api.post(`/groups/${groupId}/invite-link`, null, { params: { rotar } });
      setLink(res.data.token);
      setUsos(res.data.usos || 0);
      toast.success(rotar ? 'Link nuevo listo. El anterior dejó de servir.' : 'Link listo para compartir');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos generar el link');
    } finally {
      setTrabajando(false);
    }
  };

  const desactivar = async () => {
    setTrabajando(true);
    setPendiente(null);
    try {
      await api.delete(`/groups/${groupId}/invite-link`);
      setLink(null);
      setUsos(0);
      toast.success('Link desactivado');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos desactivar el link');
    } finally {
      setTrabajando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(urlDe(link));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles (o sin https): el link igual esta a la
      // vista y se puede seleccionar a mano.
      toast.message('Copialo a mano desde el recuadro');
    }
  };

  const compartirWhatsApp = () => {
    const texto = `Te sumo a ${groupName || 'nuestro grupo'} en Fútbol Pro: ${urlDe(link)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  };

  return (
    <SectionPanel
      icono={Link2}
      titulo="Sumar con un link"
      descripcion="Compartilo y entran solos. Entran como jugadores del grupo."
      tono="turf"
      testId="invite-link-panel"
    >
      {cargando ? (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Buscando el link...
        </p>
      ) : link ? (
        <div className="space-y-3">
          <p
            className="break-all rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700"
            data-testid="invite-link-value"
          >
            {urlDe(link)}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button onClick={copiar} shape="pill" className="h-11 px-5" data-testid="invite-link-copy">
              {copiado
                ? <><Check className="mr-2 h-4 w-4" aria-hidden="true" />Copiado</>
                : <><Copy className="mr-2 h-4 w-4" aria-hidden="true" />Copiar</>}
            </Button>
            <Button
              onClick={compartirWhatsApp}
              variant="outline"
              shape="pill"
              className="h-11 px-5"
              data-testid="invite-link-whatsapp"
            >
              <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
              WhatsApp
            </Button>
          </div>

          <p className="text-xs text-slate-600">
            {usos === 0
              ? 'Todavía no entró nadie con este link.'
              : `Entraron ${usos} ${usos === 1 ? 'jugador' : 'jugadores'} con este link.`}
          </p>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Button
              onClick={() => setPendiente({
                clave: 'rotar',
                titulo: '¿Generar un link nuevo?',
                descripcion: 'Se usa cuando el link se filtró y querés cortar el acceso.',
                consecuencias: [
                  'El link actual deja de funcionar al instante.',
                  'Quien ya entró se queda en el grupo: no se va nadie.',
                ],
                textoConfirmar: 'Generar link nuevo',
                onConfirmar: () => generar({ rotar: true }),
              })}
              variant="outline"
              shape="pill"
              disabled={trabajando}
              className="h-11 px-5 text-sm"
              data-testid="invite-link-rotate"
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Cambiar el link
            </Button>
            <Button
              onClick={() => setPendiente({
                clave: 'desactivar',
                titulo: '¿Desactivar el link?',
                descripcion: 'El grupo vuelve a ser sólo por invitación a mano.',
                consecuencias: [
                  'Nadie más puede entrar con el link que ya circuló.',
                  'Quien ya entró se queda en el grupo.',
                  'Podés generar uno nuevo cuando quieras.',
                ],
                textoConfirmar: 'Desactivar',
                onConfirmar: desactivar,
              })}
              variant="outline"
              shape="pill"
              disabled={trabajando}
              className="h-11 border-red-200 px-5 text-sm text-red-600 hover:bg-red-50"
              data-testid="invite-link-revoke"
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Desactivar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Todavía no hay link. Generá uno y compartilo por donde ya hablás con el
            grupo: quien lo abra entra solo, sin que tengas que pedirle el mail.
          </p>
          <Button
            onClick={() => generar()}
            disabled={trabajando}
            shape="pill"
            className="h-11 px-6"
            data-testid="invite-link-create"
          >
            {trabajando
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Generando...</>
              : <><Link2 className="mr-2 h-4 w-4" aria-hidden="true" />Generar link</>}
          </Button>
        </div>
      )}

      <ConfirmDialog
        abierto={!!pendiente}
        onCambio={() => setPendiente(null)}
        titulo={pendiente?.titulo}
        descripcion={pendiente?.descripcion}
        consecuencias={pendiente?.consecuencias || []}
        textoConfirmar={pendiente?.textoConfirmar}
        cargando={trabajando}
        onConfirmar={pendiente?.onConfirmar}
        testId="invite-link-confirm"
      />
    </SectionPanel>
  );
}
