import React, { useState } from 'react';
import { Crown, Link2, Shield, UserMinus, ZoomIn } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import PhotoLightbox from '@/components/common/PhotoLightbox';
import { GROUP_PERMISSION_LABELS, MEMBERSHIP_TYPE_LABELS } from '@/constants/groups';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';

export default function GroupMemberCard({
  member,
  canManage,
  canRemove,
  onRemove,
  onLinkGuest,
}) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const photoUrl = buildPhotoUrl(member.photo_url);

  return (
    <>
      <div className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            className="relative shrink-0 group rounded-full"
            title="Ver foto"
            data-testid={`group-member-photo-${member.player_id}`}
          >
            <Avatar className="w-12 h-12 sm:w-14 sm:h-14 ring-2 ring-white shadow-sm">
              <AvatarImage src={photoUrl || undefined} />
              <AvatarFallback className="bg-turf/10 text-turf-accessible text-sm font-bold">
                {initialsFromName(member.player_name)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-turf-accessible transition-colors">
              <ZoomIn className="w-3.5 h-3.5" />
            </span>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900 truncate">{member.player_name}</p>
                  {member.group_permission === 'organizador' && (
                    <Badge className="bg-turf/10 text-turf-accessible border-turf/20">
                      <Crown className="w-3 h-3 mr-1" /> Organiza
                    </Badge>
                  )}
                  {member.is_system_admin && (
                    <Badge className="bg-slate-900 text-white">
                      <Shield className="w-3 h-3 mr-1" /> Admin
                    </Badge>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 truncate mt-1">
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
                  className="rounded-full border-red-200 text-red-600 hover:bg-red-50 shrink-0"
                  data-testid={`remove-group-member-${member.id}`}
                >
                  <UserMinus className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Quitar</span>
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline">
                {GROUP_PERMISSION_LABELS[member.group_permission] || member.group_permission}
              </Badge>
              <Badge variant="outline">
                {MEMBERSHIP_TYPE_LABELS[member.membership_type] || member.membership_type}
              </Badge>
              {member.membership_type === 'invitado' && member.invited_by_name ? (
                <Badge variant="outline">Invitado por {member.invited_by_name}</Badge>
              ) : null}
            </div>

            {onLinkGuest && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onLinkGuest}
                className="mt-2 h-9 px-2 text-slate-500 hover:text-turf-accessible hover:bg-turf/5 -ml-2"
                data-testid={`link-guest-${member.player_id}`}
              >
                <Link2 className="w-3.5 h-3.5 mr-1.5" /> Vincular con invitado anterior
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
