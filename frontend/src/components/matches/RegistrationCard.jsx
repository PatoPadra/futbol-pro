import React, { useState } from 'react';
import { UserMinus, ZoomIn } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PhotoLightbox from '@/components/common/PhotoLightbox';
import PositionBadge from '@/components/common/PositionBadge';
import AttendanceControl from '@/components/matches/AttendanceControl';
import PlayerNoteField from '@/components/matches/PlayerNoteField';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';

/**
 * Fila de un inscripto.
 *
 * Un anotado es una persona, no un renglón: por eso la foto pesa, el nombre es
 * lo primero que se lee y la posición va como badge abajo. El número de orden va
 * en un círculo con el tono de su estado (verde titular, naranja suplente) para
 * que el orden de la lista de espera se entienda de un vistazo.
 *
 * La marca de asistencia va debajo del nombre y no en una pantalla aparte: quien
 * la carga la carga mirando la lista, y una pantalla "tomar asistencia" sería la
 * misma lista dos veces. Sólo aparece cuando hay algo para marcar — con la
 * inscripción todavía abierta el que no va se da de baja solo.
 */
export default function RegistrationCard({
  registration,
  index,
  canManage,
  onRemove,
  /** Opciones del catálogo. Vacío o ausente = no se muestra el control. */
  attendanceOptions,
  onAttendanceChange,
  attendanceSaving = false,
  /** Nota privada de quien mira. null o ausente = no se ofrece escribir. */
  nota,
  onNoteSave,
}) {
  const puedeMarcarAsistencia = Boolean(onAttendanceChange && attendanceOptions?.length);
  const puedeAnotar = Boolean(onNoteSave);
  const [photoOpen, setPhotoOpen] = useState(false);
  const photoUrl = buildPhotoUrl(registration.player_photo);
  const esTitular = registration.status === 'titular';

  return (
    <>
      <div
        className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-sm active:bg-slate-100 motion-reduce:transition-none"
        data-testid={`${registration.status}-${registration.player_id}`}
      >
        <span
          aria-hidden="true"
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-heading text-xs font-bold tabular-nums ${
            esTitular ? 'bg-turf/10 text-turf-accessible' : 'bg-orange/10 text-orange-accessible'
          }`}
        >
          {index + 1}
        </span>

        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          className="group relative grid h-11 w-11 shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
          data-testid={`registration-photo-${registration.player_id}`}
          title="Ver foto"
        >
          <span className="sr-only">Ver la foto de {registration.player_name} más grande</span>
          <Avatar className="h-11 w-11 ring-2 ring-white shadow-sm">
            <AvatarImage src={photoUrl || undefined} />
            <AvatarFallback className="bg-turf/10 text-xs font-bold text-turf-accessible">
              {initialsFromName(registration.player_name)}
            </AvatarFallback>
          </Avatar>
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors group-hover:border-turf group-hover:text-turf-accessible motion-reduce:transition-none"
          >
            <ZoomIn className="h-3 w-3" />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              to={`/jugadores/${registration.player_id}`}
              className="block truncate rounded text-sm font-semibold text-slate-900 hover:text-turf-accessible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
            >
              {registration.player_name}
            </Link>
            {!esTitular ? (
              <Badge
                variant="orange"
                className="min-h-0 border-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-accessible"
              >
                Suplente
              </Badge>
            ) : null}
            {registration.registration_type ? (
              <Badge
                variant="outline"
                className="min-h-0 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-600"
              >
                {registration.registration_type}
              </Badge>
            ) : null}
          </div>
          <div className="mt-1.5">
            {registration.primary_position ? (
              <PositionBadge positionId={registration.primary_position} />
            ) : (
              <p className="text-xs text-slate-600">Sin posición cargada</p>
            )}
          </div>

          {(puedeMarcarAsistencia || puedeAnotar) && (
            <div className="mt-2 flex flex-wrap items-start gap-2">
              {puedeMarcarAsistencia && (
                <AttendanceControl
                  value={registration.attendance || null}
                  options={attendanceOptions}
                  disabled={attendanceSaving}
                  playerName={registration.player_name}
                  onChange={(marca) => onAttendanceChange(registration, marca)}
                  testId={`attendance-${registration.player_id}`}
                />
              )}
              {puedeAnotar && (
                <PlayerNoteField
                  nota={nota}
                  playerName={registration.player_name}
                  disabled={attendanceSaving}
                  onSave={(texto) => onNoteSave(registration, texto)}
                />
              )}
            </div>
          )}
        </div>

        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRemove}
            shape="pill"
            className="h-11 min-w-[44px] shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 focus-visible:ring-destructive"
            data-testid={`remove-registration-${registration.id}`}
          >
            <UserMinus className="h-4 w-4 sm:mr-1" aria-hidden="true" />
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
