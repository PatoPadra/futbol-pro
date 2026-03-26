import React from 'react';
import { Plus } from 'lucide-react';

import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export default function InviteMemberForm({ form, onFormChange, onSubmit, saving }) {
  return (
    <Card className="border-slate-100">
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
              value={form.email}
              onChange={(e) => onFormChange('email', e.target.value)}
              placeholder="mail@ejemplo.com"
              className="mt-1.5 h-11 bg-slate-50 border-slate-200"
            />
          </div>

          <div>
            <Label>Nombre de usuario o nombre</Label>
            <Input
              value={form.username}
              onChange={(e) => onFormChange('username', e.target.value)}
              placeholder="usuario o nombre visible"
              className="mt-1.5 h-11 bg-slate-50 border-slate-200"
            />
          </div>

          <div>
            <Label>Nombre visible (para invitados)</Label>
            <Input
              value={form.name}
              onChange={(e) => onFormChange('name', e.target.value)}
              placeholder="Nombre del invitado"
              className="mt-1.5 h-11 bg-slate-50 border-slate-200"
            />
          </div>

          <div>
            <Label>Tipo de miembro</Label>
            <Select value={form.member_role} onValueChange={(value) => onFormChange('member_role', value)}>
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

          <p className="text-xs text-slate-500">
            La autoridad en este grupo se muestra como <strong>Organizador/Miembro</strong>.
            La forma de participación se muestra como <strong>Frecuente/Invitado</strong>.
          </p>

          <Button
            type="submit"
            disabled={saving}
            className="w-full bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase"
          >
            {saving ? 'Guardando...' : 'Agregar al grupo'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
