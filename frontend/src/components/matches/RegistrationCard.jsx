import React, { useState } from 'react';
import { UserMinus, ZoomIn } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PhotoLightbox from '@/components/common/PhotoLightbox';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';

export default function RegistrationCard({
  registration,
  index,
  canManage,
  onRemove,
}) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const photoUrl = buildPhotoUrl(registration.player_photo);

  return (
    <>
      <div
        className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50/70 transition-colors"
        data-testid={`${registration.status}-${registration.player_id}`}
      >
        <span className="text-xs font-bold text-slate-400 w-5 text-center">{index + 1}</span>

        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          className="relative shrink-0 group rounded-full"
          data-testid={`registration-photo-${registration.player_id}`}
          title="Ver foto"
        >
          <Avatar className="w-10 h-10 ring-2 ring-white shadow-sm">
            <AvatarImage src={photoUrl || undefined} />
            <AvatarFallback className="bg-turf/10 text-turf-accessible text-xs font-bold">
              {initialsFromName(registration.player_name)}
            </AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-turf-accessible transition-colors">
            <ZoomIn className="w-3 h-3" />
          </span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/jugadores/${registration.player_id}`}
              className="text-sm font-medium text-slate-900 hover:text-turf-accessible truncate block"
            >
              {registration.player_name}
            </Link>
            {registration.status === 'suplente' ? (
              <Badge variant="outline" className="text-[10px]">Suplente</Badge>
            ) : null}
            {registration.registration_type ? (
              <Badge variant="outline" className="text-[10px] capitalize">
                {registration.registration_type}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {registration.primary_position || 'Sin posición cargada'}
          </p>
        </div>

        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRemove}
            className="rounded-full border-red-200 text-red-600 hover:bg-red-50 shrink-0"
            data-testid={`remove-registration-${registration.id}`}
          >
            <UserMinus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Quitar</span>
          </Button>
        )}
      </div>

      <PhotoLightbox
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        name={registration.player_name}
        photoUrl={registration.player_photo}
        subtitle={registration.primary_position || 'Jugador del partido'}
      />
    </>
  );
}
