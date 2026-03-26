import React from 'react';
import { Plus } from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export default function InviteMemberForm({ inviteForm, setInviteForm, savingInvite, onSubmit }) {
  return (
    <Card className="border-slate-100 shadow-sm shadow-slate-100/70">
      <CardHeader>
        <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
          <Plus className="w-4 h-4" /> Invitar jugador
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input
              value={inviteForm.email}
              onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="mail@ejemplo.com"
              className="mt-1.5 h-11 bg-slate-50 border-slate-200"
            />
          </div>

          <div>
            <Label>Nombre de usuario o nombre</Label>
            <Input
              value={inviteForm.username}
              onChange={(e) => setInviteForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="usuario o nombre visible"
              className="mt-1.5 h-11 bg-slate-50 border-slate-200"
            />
          </div>

          <div>
            <Label>Nombre visible (para invitados)</Label>
            <Input
              value={inviteForm.name}
              onChange={(e) => setInviteForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre del invitado"
              className="mt-1.5 h-11 bg-slate-50 border-slate-200"
            />
          </div>

          <div>
            <Label>Tipo de miembro</Label>
            <Select
              value={inviteForm.member_role}
              onValueChange={(value) => setInviteForm((prev) => ({ ...prev, member_role: value }))}
            >
              <SelectTrigger className="mt-1.5 h-11 bg-slate-50 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="frecuente">Frecuente</SelectItem>
                <SelectItem value="invitado">Invitado</SelectItem>
                <SelectItem value="organizador">Organizador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 leading-relaxed">
            <p>
              <strong>Organizador / Miembro</strong> define autoridad dentro del grupo.
            </p>
            <p>
              <strong>Frecuente / Invitado</strong> define el tipo de participación.
            </p>
          </div>

          <Button
            type="submit"
            disabled={savingInvite}
            className="w-full bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase"
          >
            {savingInvite ? 'Guardando...' : 'Agregar al grupo'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
