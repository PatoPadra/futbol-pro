import React from 'react';
import { Check, CircleDashed, Minus, Plus, ZoomIn } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';

/**
 * Tarjeta para puntuar a un companiero.
 *
 * Es el control que mas se repite en toda la app (uno por companiero, hasta 21
 * en un futbol 11), asi que se juega todo a que cada tarjeta se resuelva de un
 * vistazo: quien es, cuanto le pusiste, y si eso ya quedo guardado. El estado
 * "guardado" va con icono ademas de color, porque en una lista larga el color
 * solo se pierde.
 *
 * No decide nada: el puntaje vive en la pagina y esta pieza solo lo muestra y
 * avisa cuando cambia.
 */
export default function PeerRatingCard({
  player,
  score,
  tone,
  guardado = false,
  disabled = false,
  onScoreChange,
  onOpenPhoto,
}) {
  const id = player.player_id;

  return (
    <div
      className={cn('rounded-2xl border bg-white p-4 shadow-sm transition-colors', tone.border)}
      data-testid={`rate-player-${id}`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onOpenPhoto(player)}
          className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
          data-testid={`view-photo-${id}`}
          aria-label={`Ver foto de ${player.player_name}`}
        >
          <Avatar className="h-12 w-12 shadow-sm ring-2 ring-white">
            <AvatarImage src={buildPhotoUrl(player.player_photo) || undefined} />
            <AvatarFallback className="bg-turf/10 text-xs font-bold text-turf-accessible">
              {initialsFromName(player.player_name)}
            </AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors group-hover:text-turf-accessible">
            <ZoomIn className="h-3 w-3" aria-hidden="true" />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{player.player_name}</p>
          <p className="truncate text-xs text-slate-600">{player.primary_position || 'Sin posición cargada'}</p>
        </div>

        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide',
            guardado
              ? 'border-turf/25 bg-turf/10 text-turf-accessible'
              : 'border-dashed border-slate-300 bg-slate-50 text-slate-600',
          )}
        >
          {guardado ? (
            <Check className="h-3 w-3" aria-hidden="true" />
          ) : (
            <CircleDashed className="h-3 w-3" aria-hidden="true" />
          )}
          {guardado ? 'Guardado' : 'Sin guardar'}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full transition-transform active:scale-95 motion-reduce:transition-none"
          onClick={() => onScoreChange(score - 1)}
          disabled={disabled || score <= 1}
          data-testid={`rating-decrement-${id}`}
          aria-label={`Bajar puntaje de ${player.player_name}`}
        >
          <Minus className="h-4 w-4" />
        </Button>

        <div className="flex-1">
          <Slider
            min={1}
            max={10}
            step={1}
            value={[score]}
            onValueChange={(value) => onScoreChange(value[0])}
            disabled={disabled}
            data-testid={`rating-slider-${id}`}
            aria-label={`Puntuación para ${player.player_name}`}
          />
          <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-slate-500" aria-hidden="true">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full transition-transform active:scale-95 motion-reduce:transition-none"
          onClick={() => onScoreChange(score + 1)}
          disabled={disabled || score >= 10}
          data-testid={`rating-increment-${id}`}
          aria-label={`Subir puntaje de ${player.player_name}`}
        >
          <Plus className="h-4 w-4" />
        </Button>

        <div className="shrink-0 text-center">
          <span
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-2xl font-heading text-2xl font-bold tabular-nums',
              tone.text,
              tone.bg,
            )}
            data-testid={`rating-value-${id}`}
          >
            {score}
          </span>
          <p className={cn('mt-1 text-[10px] font-bold uppercase tracking-wide', tone.text)}>{tone.label}</p>
        </div>
      </div>
    </div>
  );
}
