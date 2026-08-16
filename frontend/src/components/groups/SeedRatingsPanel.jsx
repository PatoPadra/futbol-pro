import React from 'react';
import { Loader2, Star, UserPlus } from 'lucide-react';

import SectionPanel from '@/components/groups/SectionPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GROUP_PERMISSION_LABELS, MEMBERSHIP_TYPE_LABELS } from '@/constants/groups';
import { getRatingTone } from '@/utils/ratings';
import { cn } from '@/lib/utils';

/**
 * Panel de puntajes iniciales.
 *
 * Es una lista de "persona + un numero", asi que se lee mejor como filas con
 * zebra suave que como una pila de tarjetas: el ojo baja por la columna de
 * inputs. El puntaje cargado se tinta con el tono de la nota (`getRatingTone`),
 * el mismo que usa el resto de la app.
 */
export default function SeedRatingsPanel({
  rateableMembers,
  ratingMap,
  ratingErrors,
  onRatingChange,
  onSave,
  saving,
  hasRatingErrors,
  myProfileId,
}) {
  const cargados = rateableMembers.filter(
    (m) => ratingMap[m.player_id] !== undefined && ratingMap[m.player_id] !== '',
  ).length;

  return (
    <SectionPanel
      icono={Star}
      titulo="Puntaje inicial del grupo"
      descripcion="Los jugadores frecuentes pueden puntuar a los demás frecuentes. Los invitados solo pueden ser puntuados por quien los invitó."
      aside={
        rateableMembers.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {cargados}/{rateableMembers.length} cargados
          </span>
        ) : null
      }
      contentClassName="space-y-4"
    >
      {rateableMembers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <Star className="mx-auto mb-2 h-6 w-6 text-slate-500" aria-hidden="true" />
          <p className="text-sm text-slate-600">
            No hay compañeros elegibles para puntuar todavía.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-slate-200">
          {rateableMembers.map((member) => {
            const valor = ratingMap[member.player_id] || '';
            const error = ratingErrors[member.player_id];
            const tono = valor && !error ? getRatingTone(Number(valor)) : null;
            const esMiInvitado =
              member.membership_type === 'invitado' && member.invited_by === myProfileId;

            return (
              <li
                key={member.player_id}
                className="flex items-center justify-between gap-3 border-b border-slate-100 p-3 last:border-b-0 odd:bg-slate-50/60 sm:p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{member.player_name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 truncate text-xs text-slate-600">
                    <span>
                      {GROUP_PERMISSION_LABELS[member.group_permission] || member.group_permission}
                      {' · '}
                      {MEMBERSHIP_TYPE_LABELS[member.membership_type] || member.membership_type}
                    </span>
                    {esMiInvitado && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-orange/45 bg-orange/10 px-2 py-0.5 font-semibold text-orange-accessible">
                        <UserPlus className="h-3 w-3" aria-hidden="true" /> Tu invitado
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value={ratingMap[member.player_id] || ''}
                    onChange={(event) => onRatingChange(member.player_id, event.target.value)}
                    aria-label={`Puntaje inicial para ${member.player_name}`}
                    aria-invalid={!!error}
                    className={cn(
                      'h-11 w-20 rounded-xl text-center font-heading text-lg font-bold tabular-nums',
                      error
                        ? 'border-red-300 bg-white focus-visible:ring-red-300'
                        : tono
                          ? `${tono.text} ${tono.bg}`
                          : 'bg-white',
                    )}
                    data-testid={`seed-rating-${member.player_id}`}
                  />
                  {error && <span className="text-[11px] font-semibold text-red-700">{error}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        onClick={onSave}
        disabled={saving || rateableMembers.length === 0 || hasRatingErrors}
        shape="pill"
        className="h-12 w-full bg-turf text-white hover:bg-turf-dark"
        data-testid="save-seed-ratings"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {saving ? 'Guardando...' : 'Guardar puntajes iniciales'}
      </Button>
    </SectionPanel>
  );
}
