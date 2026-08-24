import React from 'react';
import { Camera, Compass } from 'lucide-react';

import { labelDeFicha } from '@/constants/generos';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { initialsFromName } from '@/utils/photos';

/**
 * La ficha del jugador: la cara y las posiciones, en una sola tarjeta que sube
 * por encima de la banda del encabezado.
 *
 * Antes eran dos bloques separados (un banner con degradado plano y una tarjeta
 * "Posiciones" al final de la página). Juntarlos es lo que hace que la pantalla
 * se lea como la ficha de una persona y no como un listado de campos: la foto y
 * "de qué juega" son la misma información.
 *
 * La subida de foto es de la página: acá sólo vive el markup del input y su
 * label, con los mismos data-testid.
 */
export default function PlayerIdentityCard({
  profile,
  photoUrl,
  posMap,
  isOwn,
  uploadingPhoto,
  onPhotoChange,
  onOpenLightbox,
  className,
}) {
  const secundarias = profile.secondary_positions || [];

  return (
    <div
      className={cn(
        'relative rounded-3xl border border-slate-100 bg-white p-5 shadow-lift',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={onOpenLightbox}
            className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
            aria-label="Ver foto de perfil en grande"
            data-testid="view-profile-photo-btn"
          >
            <Avatar className="h-28 w-28 border-4 border-white shadow-lift ring-1 ring-slate-100 sm:h-32 sm:w-32">
              <AvatarImage src={photoUrl} />
              <AvatarFallback className="bg-turf/10 font-heading text-3xl font-bold text-turf-accessible">
                {initialsFromName(profile.name)}
              </AvatarFallback>
            </Avatar>
          </button>

          {uploadingPhoto && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/50">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span className="sr-only">Subiendo la foto…</span>
            </div>
          )}

          {isOwn && (
            <label
              className="absolute -bottom-1 -right-1 flex h-11 w-11 cursor-pointer items-center justify-center"
              aria-label="Cambiar foto de perfil"
              data-testid="photo-upload-label"
            >
              <input
                type="file"
                accept="image/*"
                className="peer sr-only"
                onChange={onPhotoChange}
                disabled={uploadingPhoto}
                data-testid="photo-upload-input"
              />
              <span className="pointer-events-none flex h-9 w-9 items-center justify-center rounded-full bg-turf shadow-lift-turf transition-colors hover:bg-turf-dark peer-focus-visible:ring-2 peer-focus-visible:ring-turf peer-focus-visible:ring-offset-2">
                <Camera className="h-4 w-4 text-white" aria-hidden="true" />
              </span>
            </label>
          )}
        </div>

        <div className="min-w-0 flex-1 sm:pt-1">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-tight text-slate-900">
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-lg bg-turf/10 text-turf-accessible"
            >
              <Compass className="h-4 w-4" />
            </span>
            Posiciones
          </h2>

          <dl className="mt-3 space-y-3">
            {labelDeFicha(profile.gender) && (
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                  Género
                </dt>
                <dd className="mt-1.5 text-sm font-semibold text-slate-900" data-testid="identity-gender">
                  {labelDeFicha(profile.gender)}
                </dd>
              </div>
            )}

            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                Principal
              </dt>
              <dd className="mt-1.5">
                {profile.primary_position ? (
                  <PosChip
                    sigla={profile.primary_position}
                    nombre={posMap[profile.primary_position] || profile.primary_position}
                    tono="turf"
                  />
                ) : (
                  <span className="text-sm text-slate-600">Sin definir</span>
                )}
              </dd>
            </div>

            {secundarias.length > 0 && (
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                  También juega de
                </dt>
                <dd className="mt-1.5 flex flex-wrap gap-2">
                  {secundarias.map((p) => (
                    <PosChip key={p} sigla={p} nombre={posMap[p] || p} tono="neutro" />
                  ))}
                </dd>
              </div>
            )}

            {profile.unwanted_position && (
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                  Prefiere evitar
                </dt>
                <dd className="mt-1.5">
                  <PosChip
                    sigla={profile.unwanted_position}
                    nombre={posMap[profile.unwanted_position] || profile.unwanted_position}
                    tono="evitar"
                  />
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

const TONOS_CHIP = {
  turf: 'border-turf/30 bg-turf/10 text-turf-accessible',
  neutro: 'border-slate-200 bg-slate-50 text-slate-700',
  evitar: 'border-rose-200 bg-rose-50 text-rose-700',
};

const TONOS_SIGLA = {
  turf: 'bg-turf text-white',
  neutro: 'bg-slate-200 text-slate-700',
  evitar: 'bg-rose-600 text-white',
};

function PosChip({ sigla, nombre, tono }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-semibold',
        TONOS_CHIP[tono] || TONOS_CHIP.neutro,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid h-7 w-7 place-items-center rounded-full font-heading text-[11px] font-bold uppercase leading-none',
          TONOS_SIGLA[tono] || TONOS_SIGLA.neutro,
        )}
      >
        {sigla}
      </span>
      {nombre}
    </span>
  );
}
