import React from 'react';
import { Calendar, Clock, ExternalLink, MapPin, Users } from 'lucide-react';

import { Card, CardContent } from '../ui/card';

export default function MatchMetaGrid({ match, titularCount }) {
  return (
    <Card className="border-slate-100 mb-6">
      <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>{match.date}</span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>{match.time}</span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span>{match.location}</span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Users className="w-4 h-4 text-slate-400" />
          <span>{titularCount}/{match.max_players} titulares</span>
        </div>

        {match.maps_link && (
          <a
            href={match.maps_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-turf hover:underline col-span-full"
            data-testid="maps-link"
          >
            <ExternalLink className="w-4 h-4" />
            Ver ubicacion en mapa
          </a>
        )}
      </CardContent>
    </Card>
  );
}
