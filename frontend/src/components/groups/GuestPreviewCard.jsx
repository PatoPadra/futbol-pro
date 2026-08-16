import React from 'react';
import { UserPlus } from 'lucide-react';

import PhotoBackdrop from '@/components/media/PhotoBackdrop';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getFoto } from '@/constants/fotos';
import { initialsFromName } from '@/utils/photos';

/**
 * Vista previa del invitado que se esta creando.
 *
 * Este flujo no genera ningun link ni codigo para compartir: crea la ficha de
 * alguien que no tiene cuenta. Lo que merece ser el protagonista de la pantalla,
 * entonces, es la ficha misma — asi que se muestra armandose en vivo mientras
 * se completa el formulario, con la foto, el nombre, la posicion y el nivel.
 *
 * Es 100% derivada de los valores del form: no guarda estado propio.
 */
const FOTO = getFoto(36315147); // dos chicos jugando en una calle arbolada, vertical

export default function GuestPreviewCard({ nombre, photoPreview, posicion, nivel, nivelLabel }) {
  const nombreVisible = (nombre || '').trim();

  return (
    <PhotoBackdrop
      foto={FOTO}
      scrim="turf"
      posicion="50% 35%"
      className="rounded-3xl shadow-lift"
      data-testid="guest-preview"
    >
      <div className="p-5 md:p-6">
        <p className="mb-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-turf-light">
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Así va a quedar la ficha
        </p>

        <div className="flex items-center gap-4">
          <div className="rounded-full border-2 border-dashed border-white/50 p-1">
            <Avatar className="h-16 w-16 md:h-20 md:w-20">
              <AvatarImage src={photoPreview || undefined} alt="" />
              <AvatarFallback className="bg-white/15 font-heading text-lg font-bold text-white">
                {nombreVisible ? initialsFromName(nombreVisible) : '?'}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={
                nombreVisible
                  ? 'truncate font-heading text-2xl font-bold uppercase leading-none tracking-tight text-white md:text-3xl'
                  : 'truncate font-heading text-2xl font-bold uppercase leading-none tracking-tight text-white/60 md:text-3xl'
              }
            >
              {nombreVisible || 'Sin nombre'}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="glass-dark inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white">
                {posicion || 'Sin posición'}
              </span>
              <span className="glass-dark inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white">
                Nivel <span className="font-heading tabular-nums">{nivel}</span> · {nivelLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </PhotoBackdrop>
  );
}
