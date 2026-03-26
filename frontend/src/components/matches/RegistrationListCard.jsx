import React from 'react';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

function RegistrationRow({ registration, index, fallbackClassName, photoUrl }) {
  return (
    <div
      key={registration.id}
      className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"
      data-testid={`${registration.status}-${registration.player_id}`}
    >
      <span className="text-xs font-bold text-slate-400 w-5">{index + 1}</span>

      <Avatar className="w-9 h-9">
        <AvatarImage src={registration.player_photo ? (photoUrl ? `${photoUrl}${registration.player_photo}` : registration.player_photo) : undefined} />
        <AvatarFallback className={fallbackClassName}>
          {registration.player_name?.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <Link
          to={`/jugadores/${registration.player_id}`}
          className="text-sm font-medium text-slate-900 hover:text-turf truncate block"
        >
          {registration.player_name}
        </Link>
        {registration.primary_position && (
          <span className="text-xs text-slate-400">{registration.primary_position}</span>
        )}
      </div>
    </div>
  );
}

export default function RegistrationListCard({ title, registrations, tone = 'turf', maxPlayers, photoBaseUrl }) {
  const toneConfig =
    tone === 'orange'
      ? {
          dot: 'bg-orange',
          fallback: 'bg-orange/10 text-orange text-xs font-bold',
        }
      : {
          dot: 'bg-turf',
          fallback: 'bg-turf/10 text-turf text-xs font-bold',
        };

  return (
    <Card className="border-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${toneConfig.dot}`} />
          {title}
          {typeof maxPlayers === 'number' ? ` (${registrations.length}/${maxPlayers})` : ` (${registrations.length})`}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        {registrations.length === 0 && (
          <p className="text-sm text-slate-400 py-4 text-center">
            {tone === 'orange' ? 'Sin suplentes aun' : 'Sin titulares aun'}
          </p>
        )}

        {registrations.map((registration, index) => (
          <RegistrationRow
            key={registration.id}
            registration={registration}
            index={index}
            fallbackClassName={toneConfig.fallback}
            photoUrl={photoBaseUrl}
          />
        ))}
      </CardContent>
    </Card>
  );
}
