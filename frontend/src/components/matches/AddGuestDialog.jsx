import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';

export default function AddGuestDialog({ open, onOpenChange, matchId, groupId, registeredPlayerIds, onRegistered }) {
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [registeringId, setRegisteringId] = useState('');
  const [newGuestName, setNewGuestName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setNewGuestName('');
    setLoadError(false);
    setLoadingMembers(true);
    api
      .get(`/groups/${groupId}/members`)
      .then((res) => setMembers(res.data || []))
      .catch(() => setLoadError(true))
      .finally(() => setLoadingMembers(false));
  }, [open, groupId]);

  const eligibleGuests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members
      .filter((m) => m.member_role === 'invitado' && !registeredPlayerIds.has(m.player_id))
      .filter((m) => !term || m.player_name?.toLowerCase().includes(term));
  }, [members, registeredPlayerIds, search]);

  const registerGuest = async (playerId) => {
    setRegisteringId(playerId);
    try {
      await api.post(`/matches/${matchId}/register-guest/${playerId}`);
      setMembers((prev) => prev.filter((m) => m.player_id !== playerId));
      toast.success('Invitado anotado');
      onRegistered();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo anotar al invitado');
    } finally {
      setRegisteringId('');
    }
  };

  const handleCreateAndRegister = async (e) => {
    e.preventDefault();
    const name = newGuestName.trim();
    if (name.length < 2) {
      toast.error('Ingresá un nombre válido');
      return;
    }

    setCreating(true);
    try {
      const guestRes = await api.post('/players/guest', { name });
      const guestId = guestRes.data.id;

      await api.post(`/groups/${groupId}/members`, { player_id: guestId, member_role: 'invitado' });
      await api.post(`/matches/${matchId}/register-guest/${guestId}`);

      toast.success(`${name} fue creado y anotado`);
      setNewGuestName('');
      onRegistered();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo crear al invitado');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]" data-testid="add-guest-dialog">
        <DrawerHeader>
          <DrawerTitle className="font-heading uppercase tracking-tight flex items-center justify-center sm:justify-start gap-2">
            <span className="w-8 h-8 rounded-full bg-turf/10 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4 text-turf-accessible" />
            </span>
            Agregar invitado
          </DrawerTitle>
          <DrawerDescription>
            Elegí un invitado del grupo o creá uno nuevo para anotarlo a este partido.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar invitado por nombre"
            className="pl-9 h-11"
            data-testid="add-guest-search"
          />
        </div>
        <p className="text-xs text-slate-500 -mt-2">Mostrando invitados de este grupo.</p>

        <div className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-2">
          {loadingMembers ? (
            <div className="flex items-center justify-center py-8 text-slate-500" role="status">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="sr-only">Cargando invitados...</span>
            </div>
          ) : loadError ? (
            <p className="text-sm text-red-600 text-center py-6">No pudimos cargar los miembros del grupo.</p>
          ) : eligibleGuests.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              {members.length === 0
                ? 'Este grupo todavía no tiene invitados.'
                : 'No hay invitados disponibles para anotar (ya están todos en el partido o no coinciden con la búsqueda).'}
            </p>
          ) : (
            eligibleGuests.map((m) => (
              <div
                key={m.player_id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-2.5 transition-colors hover:bg-slate-50/80 motion-reduce:transition-none"
                data-testid={`add-guest-row-${m.player_id}`}
              >
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage src={buildPhotoUrl(m.photo_url) || undefined} />
                  <AvatarFallback className="bg-turf/10 text-turf-accessible text-xs font-bold">
                    {initialsFromName(m.player_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{m.player_name}</p>
                  <p className="text-xs text-slate-500">{m.primary_position || 'Sin posición cargada'}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => registerGuest(m.player_id)}
                  disabled={registeringId === m.player_id}
                  shape="pill"
                  className="h-11 min-w-20 shrink-0 bg-turf text-white hover:bg-turf-dark focus-visible:ring-turf"
                  data-testid={`add-guest-confirm-${m.player_id}`}
                >
                  {registeringId === m.player_id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Anotar'}
                </Button>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleCreateAndRegister} className="border-t border-slate-100 pt-4 space-y-2.5">
          <p className="text-sm font-medium text-slate-700">¿No está en la lista?</p>
          <div className="flex gap-2">
            <Input
              value={newGuestName}
              onChange={(e) => setNewGuestName(e.target.value)}
              placeholder="Nombre del invitado nuevo"
              className="h-11"
              data-testid="new-guest-name-input"
            />
            <Button
              type="submit"
              disabled={creating}
              className="h-11 px-4 shrink-0 rounded-full bg-orange hover:bg-orange-light text-white"
              data-testid="new-guest-create-submit"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span className="hidden sm:inline ml-1.5">Crear y anotar</span>
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Se crea con datos básicos; podés completar foto y posición después desde su perfil.
          </p>
        </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
