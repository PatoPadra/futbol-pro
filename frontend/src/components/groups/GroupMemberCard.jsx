import React, { useState } from 'react';
import { Crown, Link2, Shield, UserCheck, UserMinus, UserPlus, ZoomIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import PhotoLightbox from '@/components/common/PhotoLightbox';
import { GROUP_PERMISSION_LABELS, MEMBERSHIP_TYPE_LABELS } from '@/constants/groups';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';
import { cn } from '@/lib/utils';

/**
 * Chip estatico de la tarjeta.
 *
 * No usa `Badge` a proposito: el badge de la app tiene `min-h-11` porque muchos
 * se usan como chips clickeables, y una tarjeta de persona con tres badges de
 * 44px de alto queda toda de aire. Estos son texto, no botones.
 */
function Chip({ icono: Icono, tono = 'slate', children }) {
  const TONOS = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    turf: 'border-turf/25 bg-turf/10 text-turf-accessible',
    orange: 'border-orange/30 bg-orange/10 text-orange-accessible',
    charcoal: 'border-slate-900 bg-slate-900 text-white',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-tight',
        TONOS[tono] || TONOS.slate,
      )}
    >
      {Icono && <Icono className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * Tarjeta de un miembro del grupo.
 *
 * La lista de miembros es una lista de personas, no de filas: foto grande,
 * nombre primero, y el rol como chip.
 *
 * Invitado y frecuente se distinguen por FORMA y no solo por color: el invitado
 * lleva borde punteado, el marco de la foto punteado y el chip con icono de
 * "sumar persona"; el frecuente lleva borde y marco llenos con icono de
 * "persona confirmada". Asi sigue siendo legible en escala de grises y para
 * alguien que no distingue el verde del naranja.
 */
export default function GroupMemberCard({
  member,
  canManage,
  canRemove,
  onRemove,
  onLinkGuest,
}) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const photoUrl = buildPhotoUrl(member.photo_url);
  const esInvitado = member.membership_type === 'invitado';
  const organiza = member.group_permission === 'organizador';

  return (
    <>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border bg-white p-3 pl-4 shadow-sm transition-shadow hover:shadow-lift active:bg-slate-50 sm:p-4 sm:pl-5',
          esInvitado ? 'border-dashed border-orange/45' : 'border-slate-200',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-y-0 left-0 w-1.5',
            esInvitado ? 'bg-orange/50' : 'bg-turf',
          )}
        />

        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            className={cn(
              'group relative shrink-0 rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2',
              esInvitado ? 'border-2 border-dashed border-orange/60' : 'border-2 border-turf/25',
            )}
            title="Ver foto"
            aria-label={`Ver la foto de ${member.player_name}`}
            data-testid={`group-member-photo-${member.player_id}`}
          >
            <Avatar className="h-11 w-11 shadow-sm sm:h-14 sm:w-14">
              <AvatarImage src={photoUrl || undefined} />
              <AvatarFallback className="bg-turf/10 text-sm font-bold text-turf-accessible">
                {initialsFromName(member.player_name)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors group-hover:text-turf-accessible">
              <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate font-heading text-base font-bold uppercase leading-tight tracking-tight text-slate-900">
                    {member.player_name}
                  </p>
                  {organiza && (
                    <Chip icono={Crown} tono="turf">
                      Organiza
                    </Chip>
                  )}
                  {member.is_system_admin && (
                    <Chip icono={Shield} tono="charcoal">
                      Admin
                    </Chip>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-slate-600 sm:text-sm">
                  {member.player_email || 'Sin email'}
                  {member.primary_position ? ` · ${member.primary_position}` : ''}
                </p>
              </div>

              {canManage && canRemove && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRemove}
                  className="h-11 shrink-0 rounded-full border-red-200 px-3 text-red-700 hover:bg-red-50 hover:text-red-800"
                  data-testid={`remove-group-member-${member.id}`}
                >
                  <UserMinus className="h-4 w-4 sm:mr-1" aria-hidden="true" />
                  <span className="hidden sm:inline">Quitar</span>
                  <span className="sr-only sm:hidden">Quitar del grupo</span>
                </Button>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Chip icono={esInvitado ? UserPlus : UserCheck} tono={esInvitado ? 'orange' : 'turf'}>
                {MEMBERSHIP_TYPE_LABELS[member.membership_type] || member.membership_type}
              </Chip>
              <Chip>
                {GROUP_PERMISSION_LABELS[member.group_permission] || member.group_permission}
              </Chip>
              {esInvitado && member.invited_by_name ? (
                <Chip>Invitado por {member.invited_by_name}</Chip>
              ) : null}
            </div>

            {onLinkGuest && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onLinkGuest}
                className="-ml-2 mt-2 h-11 px-2 text-slate-600 hover:bg-turf/5 hover:text-turf-accessible"
                data-testid={`link-guest-${member.player_id}`}
              >
                <Link2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Vincular con invitado
                anterior
              </Button>
            )}
          </div>
        </div>
      </div>

      <PhotoLightbox
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        name={member.player_name}
        photoUrl={member.photo_url}
        subtitle={member.primary_position || member.player_email || 'Jugador del grupo'}
      />
    </>
  );
}
