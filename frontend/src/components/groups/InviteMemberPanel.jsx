import React from 'react';
import { Controller } from 'react-hook-form';
import { AlertCircle, Loader2, UserPlus } from 'lucide-react';

import SectionPanel from '@/components/groups/SectionPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Panel para sumar gente al grupo.
 *
 * El formulario esta agrupado en dos partes tituladas ("Quién es" / "Cómo
 * entra") en vez de ser una pila de cinco campos: los tres primeros son formas
 * alternativas de identificar a la misma persona, y conviene que se lea asi.
 *
 * El estado del form (react-hook-form + zod) vive en GroupDetail; aca solo se
 * pinta.
 */
export default function InviteMemberPanel({
  onSubmit,
  register,
  control,
  errors,
  saving,
  serverError,
}) {
  return (
    <SectionPanel
      icono={UserPlus}
      titulo="Sumar jugador"
      descripcion="Podés sumar jugadores frecuentes o invitados al grupo."
      tono="mesh"
      className="xl:sticky xl:top-20"
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate data-testid="group-invite-form">
        {serverError && (
          <div
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            role="alert"
            aria-live="polite"
            data-testid="group-invite-server-error"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{serverError}</span>
          </div>
        )}

        <fieldset className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
            Quién es
          </legend>
          <p className="-mt-1 text-xs leading-relaxed text-slate-600">
            Con uno solo de los tres alcanza. Si ya tiene cuenta, el usuario o el email lo
            enganchan con su perfil.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Nombre</Label>
            <Input
              id="invite-name"
              placeholder="Ej: Juan Pérez"
              aria-invalid={!!errors.name}
              className={`h-12 rounded-xl bg-slate-50 ${errors.name ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
              data-testid="group-invite-name"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs font-semibold text-red-700" data-testid="group-invite-name-error">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-username">Usuario exacto</Label>
            <Input
              id="invite-username"
              placeholder="Si ya existe en la app"
              aria-invalid={!!errors.username}
              className={`h-12 rounded-xl bg-slate-50 ${errors.username ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
              data-testid="group-invite-username"
              {...register('username')}
            />
            {errors.username && (
              <p
                className="text-xs font-semibold text-red-700"
                data-testid="group-invite-username-error"
              >
                {errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="email@jugador.com"
              aria-invalid={!!errors.email}
              className={`h-12 rounded-xl bg-slate-50 ${errors.email ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
              data-testid="group-invite-email"
              {...register('email')}
            />
            {errors.email && (
              <p
                className="text-xs font-semibold text-red-700"
                data-testid="group-invite-email-error"
              >
                {errors.email.message}
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-2 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
            Cómo entra
          </legend>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Tipo de miembro</Label>
            <Controller
              control={control}
              name="member_role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="invite-role"
                    className="h-12 rounded-xl bg-slate-50"
                    data-testid="group-invite-role"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frecuente">Frecuente</SelectItem>
                    <SelectItem value="invitado">Invitado</SelectItem>
                    <SelectItem value="organizador">Organizador</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            <strong className="font-semibold text-slate-700">Frecuente</strong> juega siempre y
            puntúa al resto. <strong className="font-semibold text-slate-700">Invitado</strong> viene
            de prestado. <strong className="font-semibold text-slate-700">Organizador</strong> arma
            los partidos.
          </p>
        </fieldset>

        <Button
          type="submit"
          disabled={saving}
          shape="pill"
          className="h-12 w-full bg-turf text-white hover:bg-turf-dark"
          data-testid="group-invite-submit"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Agregando...' : 'Agregar al grupo'}
        </Button>
      </form>
    </SectionPanel>
  );
}
