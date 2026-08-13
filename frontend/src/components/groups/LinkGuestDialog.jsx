import React, { useMemo, useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';

export default function LinkGuestDialog({ open, onOpenChange, groupId, targetMember, guests, onMerged }) {
  const [mergingId, setMergingId] = useState('');

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
      onOpenChange(false);
      onMerged();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo vincular al invitado');
    } finally {
      setMergingId('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="link-guest-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-tight">Vincular con invitado anterior</DialogTitle>
          <DialogDescription>
            Elegí el invitado que corresponde a <strong>{targetMember?.player_name}</strong>. Su historial de
            partidos y calificaciones se va a sumar a esta cuenta, y el invitado se va a borrar del grupo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-2">
          {eligibleGuests.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
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
                  <p className="text-xs text-slate-400">{guest.primary_position || 'Sin posición cargada'}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleMerge(guest)}
                  disabled={mergingId === guest.player_id}
                  className="rounded-full bg-turf hover:bg-turf-dark text-white shrink-0 min-w-20"
                  data-testid={`link-guest-confirm-${guest.player_id}`}
                >
                  {mergingId === guest.player_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
