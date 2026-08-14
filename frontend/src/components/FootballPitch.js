import React from 'react';
import { buildPhotoUrl } from '@/utils/photos';
import { TEAM_COLORS } from '@/constants/matches';

export default function FootballPitch({ assignments, formation, coords, teamLabel, teamColor }) {
  const teamAssignments = assignments?.filter(a => a.team === teamLabel) || [];
  const resolvedColor = teamColor || (teamLabel === 'A' ? TEAM_COLORS.A : TEAM_COLORS.B);

  return (
    <div
      className="relative bg-pitch rounded-xl overflow-hidden border-4 border-white/20 shadow-inner aspect-[2/3] md:aspect-[3/2]"
      data-testid={`pitch-team-${teamLabel}`}
    >
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/30" />
        <div className="absolute left-1/2 top-1/2 w-20 h-20 -translate-x-1/2 -translate-y-1/2 border-2 border-white/30 rounded-full" />
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2/3 h-[18%] border-b-2 border-l-2 border-r-2 border-white/30" />
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-1/3 h-[8%] border-b-2 border-l-2 border-r-2 border-white/30" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-2/3 h-[18%] border-t-2 border-l-2 border-r-2 border-white/30" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1/3 h-[8%] border-t-2 border-l-2 border-r-2 border-white/30" />
        <div className="absolute inset-2 border-2 border-white/30 rounded-lg" />
      </div>

      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <span
          className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white"
          style={{ backgroundColor: resolvedColor }}
        >
          Equipo {teamLabel}
        </span>
      </div>

      {coords?.map((coord, i) => {
        const player = teamAssignments[i];

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
              <div className="w-9 h-9 rounded-full border-2 border-dashed border-white/50 bg-white/10 flex items-center justify-center text-white/70 text-[9px] font-bold">
                {coord.pos}
              </div>
            </div>
          );
        }

        const photoUrl = buildPhotoUrl(player.player_photo);

        return (
          <div
            key={i}
            className="absolute z-10 flex flex-col items-center transition-all duration-300"
            style={{
              left: `${coord.x}%`,
              top: `${coord.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            data-testid={`player-marker-${teamLabel}-${i}`}
            role="group"
            aria-label={`${player.player_name}, ${coord.pos}, Equipo ${teamLabel}`}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="w-9 h-9 rounded-full border-2 shadow-lg object-cover"
                style={{ borderColor: resolvedColor }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full border-2 shadow-lg flex items-center justify-center text-white text-xs font-bold"
                style={{
                  backgroundColor: resolvedColor,
                  borderColor: 'white',
                }}
              >
                {player.player_name?.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="mt-0.5 text-[10px] leading-tight font-bold text-white bg-black/60 px-1.5 py-0.5 rounded-full whitespace-nowrap max-w-[72px] truncate">
              {player.player_name?.split(' ')[0]}
            </span>
            <span className="mt-0.5 text-[9px] leading-tight font-bold text-white bg-black/60 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              {coord.pos}
            </span>
          </div>
        );
      })}

      {formation && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
          <span className="px-2 py-0.5 rounded bg-black/50 text-white text-xs font-bold">
            {formation}
          </span>
        </div>
      )}
    </div>
  );
}
