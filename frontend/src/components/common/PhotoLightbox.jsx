import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';

export default function PhotoLightbox({
  open,
  onOpenChange,
  name,
  photoUrl,
  subtitle,
}) {
  const resolvedUrl = buildPhotoUrl(photoUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-4 sm:p-6 border-slate-200">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl uppercase tracking-tight">
            {name || 'Jugador'}
          </DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>

        <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
          {resolvedUrl ? (
            <img
              src={resolvedUrl}
              alt={name || 'Jugador'}
              className="w-full max-h-[75vh] object-contain bg-slate-900/5"
            />
          ) : (
            <div className="min-h-[360px] flex flex-col items-center justify-center gap-4 text-slate-500">
              <Avatar className="w-28 h-28">
                <AvatarImage src={undefined} />
                <AvatarFallback className="bg-turf/10 text-turf-accessible text-2xl font-bold">
                  {initialsFromName(name)}
                </AvatarFallback>
              </Avatar>
              <p className="text-sm">Este jugador todavía no tiene foto cargada.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
