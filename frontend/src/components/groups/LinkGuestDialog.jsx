import React, { useMemo, useState } from 'react';
import { AlertTriangle, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';

export default function LinkGuestDialog({ open, onOpenChange, groupId, targetMember, guests, onMerged }) {
  const [mergingId, setMergingId] = useState('');
  const [pendingGuest, setPendingGuest] = useState(null);

  const eligibleGuests = useMemo(
    () => (guests || []).filter((g) => g.player_id !== targetMember?.player_id),
    [guests, targetMember]
  );

  const handleMerge = async (guest) => {
    setMergingId(guest.player_id);
    try {
      await api.post(`/groups/${groupId}/members/${targetMember.id}/merge-guest`, {
        guest_player_id: guest.player_id,
      });
      toast.success(`${guest.player_name} quedó vinculado a ${targetMember.player_name}`);
      setPendingGuest(null);
      onOpenChange(false);
      onMerged();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo vincular al invitado');
    } finally {
      setMergingId('');
    }
  };

  return (
    <>
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]" data-testid="link-guest-dialog">
        <DrawerHeader>
          <DrawerTitle className="font-heading uppercase tracking-tight">Vincular con invitado anterior</DrawerTitle>
          <DrawerDescription>
            Elegí el invitado que corresponde a <strong>{targetMember?.player_name}</strong>. Su historial de
            partidos y calificaciones se va a sumar a esta cuenta, y el invitado se va a borrar del grupo.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-2 overflow-y-auto">
          {eligibleGuests.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-8">
              Este grupo no tiene invitados disponibles para vincular.
            </p>
          ) : (
            eligibleGuests.map((guest) => (
              <div
                key={guest.player_id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5"
                data-testid={`link-guest-row-${guest.player_id}`}
              >
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage src={buildPhotoUrl(guest.photo_url) || undefined} />
                  <AvatarFallback className="bg-turf/10 text-turf-accessible text-xs font-bold">
                    {initialsFromName(guest.player_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{guest.player_name}</p>
                  <p className="text-xs text-slate-600">{guest.primary_position || 'Sin posición cargada'}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setPendingGuest(guest)}
                  disabled={mergingId === guest.player_id}
                  className="rounded-full bg-turf-btn hover:bg-turf-btn-dark text-white shrink-0"
                  data-testid={`link-guest-confirm-${guest.player_id}`}
                >
                  {mergingId === guest.player_id ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Link2 className="w-4 h-4 mr-1.5" />}
                  Vincular
                </Button>
              </div>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>

      <AlertDialog open={!!pendingGuest} onOpenChange={(next) => !next && setPendingGuest(null)}>
        <AlertDialogContent className="rounded-2xl" data-testid="link-guest-merge-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-accessible shrink-0" />
              ¿Vincular a {pendingGuest?.player_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Su historial de partidos y calificaciones se va a sumar a <strong>{targetMember?.player_name}</strong>,
              y el invitado <strong>{pendingGuest?.player_name}</strong> se va a borrar del grupo. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="link-guest-merge-cancel"
              disabled={!!mergingId}
              className="rounded-full font-bold uppercase tracking-wide"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingGuest) handleMerge(pendingGuest);
              }}
              disabled={!!mergingId}
              className="rounded-full font-bold uppercase tracking-wide"
              data-testid="link-guest-merge-confirm-btn"
            >
              {mergingId ? 'Vinculando...' : 'Vincular y fusionar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
