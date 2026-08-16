import React from 'react';
import { buildPhotoUrl } from '@/utils/photos';
import { TEAM_COLORS } from '@/constants/matches';
import TeamCrest from '@/components/teams/TeamCrest';
import { identidadDeEquipo } from '@/components/teams/teamIdentity';

/**
 * La canchita con los jugadores parados en su posicion.
 *
 * Es la protagonista de "equipos generados": el momento en que se revela quien
 * juega con quien. Por eso el cesped esta dibujado en serio (rayas de corte,
 * lineas, areas, semicirculo central, banderines) y los jugadores entran
 * escalonados, como cuando salen a la cancha de a uno.
 *
 * El escalonado usa `animate-slide-up` con delay por indice y
 * `[animation-fill-mode:backwards]`: sin el fill-mode el marcador se ve en su
 * lugar final durante el delay y despues salta a opacidad 0, que se lee como un
 * parpadeo. Con movimiento reducido no hay animacion.
 *
 * La API no cambio: assignments, formation, coords, teamLabel, teamColor.
 */
export default function FootballPitch({ assignments, formation, coords, teamLabel, teamColor }) {
  const teamAssignments = assignments?.filter(a => a.team === teamLabel) || [];
  const resolvedColor = teamColor || (teamLabel === 'A' ? TEAM_COLORS.A : TEAM_COLORS.B);
  const identidad = identidadDeEquipo(teamLabel);

  return (
    <div
      className="relative aspect-[2/3] overflow-hidden rounded-3xl bg-pitch-dark shadow-lift md:aspect-[3/2]"
      data-testid={`pitch-team-${teamLabel}`}
    >
      {/* Cesped: degradado + rayas de corte + viniete para que no quede plano. */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-pitch via-pitch to-pitch-dark" />
      <div aria-hidden="true" className="absolute inset-0 bg-pitch-stripes" />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.10) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.38) 100%)' }}
      />

      {/* Lineas. */}
      <div aria-hidden="true" className="absolute inset-0">
        {/* Perimetro */}
        <div className="absolute inset-3 rounded-sm border-2 border-white/40" />

        {/* Linea del medio, circulo central y punto central */}
        <div className="absolute left-3 right-3 top-1/2 h-0.5 -translate-y-1/2 bg-white/40" />
        <div className="absolute left-1/2 top-1/2 h-[22%] w-[22%] min-h-[64px] min-w-[64px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40" />
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />

        {/* Area grande y area chica, arriba */}
        <div className="absolute left-1/2 top-3 h-[17%] w-[58%] -translate-x-1/2 border-x-2 border-b-2 border-white/40" />
        <div className="absolute left-1/2 top-3 h-[7%] w-[30%] -translate-x-1/2 border-x-2 border-b-2 border-white/40" />
        <div className="absolute left-1/2 top-[13%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/60" />
        {/* Arco de arriba */}
        <div className="absolute left-1/2 top-3 h-2 w-[16%] -translate-x-1/2 -translate-y-full rounded-t-sm border-x-2 border-t-2 border-white/55 bg-white/10" />

        {/* Area grande y area chica, abajo */}
        <div className="absolute bottom-3 left-1/2 h-[17%] w-[58%] -translate-x-1/2 border-x-2 border-t-2 border-white/40" />
        <div className="absolute bottom-3 left-1/2 h-[7%] w-[30%] -translate-x-1/2 border-x-2 border-t-2 border-white/40" />
        <div className="absolute bottom-[13%] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/60" />
        {/* Arco de abajo */}
        <div className="absolute bottom-3 left-1/2 h-2 w-[16%] -translate-x-1/2 translate-y-full rounded-b-sm border-x-2 border-b-2 border-white/55 bg-white/10" />

        {/* Banderines: cuartos de circulo en las cuatro esquinas */}
        <div className="absolute left-3 top-3 h-4 w-4 rounded-br-full border-b-2 border-r-2 border-white/40" />
        <div className="absolute right-3 top-3 h-4 w-4 rounded-bl-full border-b-2 border-l-2 border-white/40" />
        <div className="absolute bottom-3 left-3 h-4 w-4 rounded-tr-full border-r-2 border-t-2 border-white/40" />
        <div className="absolute bottom-3 right-3 h-4 w-4 rounded-tl-full border-l-2 border-t-2 border-white/40" />
      </div>

      {/* Inicial del equipo, marca de agua en el centro. */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-heading text-[7rem] font-bold leading-none text-white/[0.07] md:text-[9rem]"
      >
        {teamLabel}
      </span>

      {/* Chapa del equipo. */}
      <div className="absolute left-3 right-3 top-4 z-20 flex items-center justify-center">
        <span
          className="inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 shadow-lg ring-1 ring-white/25"
          style={{ backgroundColor: resolvedColor }}
        >
          <TeamCrest team={teamLabel} tamanio="xs" />
          <span className={`text-xs font-bold uppercase tracking-wider ${identidad.sobreColor}`}>
            Equipo {teamLabel}
          </span>
        </span>
      </div>

      {coords?.map((coord, i) => {
        const player = teamAssignments[i];
        const delay = `${Math.min(i, 14) * 70}ms`;

        if (!player) {
          return (
            <div
              key={i}
              className="absolute z-10 flex flex-col items-center"
              style={{
                left: `${coord.x}%`,
                top: `${coord.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              data-testid={`player-marker-empty-${teamLabel}-${i}`}
              role="group"
              aria-label={`Posición vacía: ${coord.pos}`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-white/60 bg-slate-950/25 text-[10px] font-bold text-white">
                {coord.pos}
              </div>
              <span className="mt-1 rounded-full bg-slate-950/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/90">
                Libre
              </span>
            </div>
          );
        }

        const photoUrl = buildPhotoUrl(player.player_photo);

        return (
          <div
            key={i}
            className="absolute z-10"
            style={{
              left: `${coord.x}%`,
              top: `${coord.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            data-testid={`player-marker-${teamLabel}-${i}`}
            role="group"
            aria-label={`${player.player_name}, ${coord.pos}, Equipo ${teamLabel}`}
          >
            {/* La animacion va en un div aparte: los keyframes de slide-up
                animan `transform` y le pisarian el centrado al contenedor. */}
            <div
              className="flex animate-slide-up flex-col items-center [animation-fill-mode:backwards] motion-reduce:animate-none"
              style={{ animationDelay: delay }}
            >
            <span className="relative block">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  loading="lazy"
                  decoding="async"
                  alt=""
                  className="h-11 w-11 rounded-full border-2 object-cover shadow-lg ring-1 ring-slate-950/30"
                  style={{ borderColor: resolvedColor }}
                />
              ) : (
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow-lg ${identidad.sobreColor}`}
                  style={{ backgroundColor: resolvedColor }}
                >
                  {player.player_name?.substring(0, 2).toUpperCase()}
                </span>
              )}
              {/* La posicion pegada al avatar, en vez de una tercera linea de texto. */}
              <span
                aria-hidden="true"
                className="absolute -bottom-1 -right-1 rounded-full border border-white/70 bg-slate-950/85 px-1 py-px text-[8px] font-bold uppercase leading-tight text-white"
              >
                {coord.pos}
              </span>
            </span>
            <span className="mt-1 max-w-[76px] truncate rounded-full bg-slate-950/75 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-white">
              {player.player_name?.split(' ')[0]}
            </span>
            </div>
          </div>
        );
      })}

      {formation && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
          <span className="rounded-full bg-slate-950/70 px-2.5 py-1 text-xs font-bold tabular-nums text-white ring-1 ring-white/20">
            {formation}
          </span>
        </div>
      )}
    </div>
  );
}
