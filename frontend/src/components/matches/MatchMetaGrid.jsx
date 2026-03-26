import React from 'react';
import { Calendar, Clock, ExternalLink, MapPin, Users } from 'lucide-react';

export default function MatchMetaGrid({ match, titularsCount }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100/70">
        <div className="flex items-center gap-2 text-slate-400 mb-1">
          <Calendar className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wide">Fecha</span>
        </div>
        <p className="text-sm font-semibold text-slate-900">{match.date}</p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100/70">
        <div className="flex items-center gap-2 text-slate-400 mb-1">
          <Clock className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wide">Hora</span>
        </div>
        <p className="text-sm font-semibold text-slate-900">{match.time}</p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100/70">
        <div className="flex items-center gap-2 text-slate-400 mb-1">
          <Users className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wide">Titulares</span>
        </div>
        <p className="text-sm font-semibold text-slate-900">{titularsCount}/{match.max_players}</p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100/70">
        <div className="flex items-center gap-2 text-slate-400 mb-1">
          <MapPin className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wide">Lugar</span>
        </div>
        <p className="text-sm font-semibold text-slate-900 truncate">{match.location}</p>
        {match.maps_link && (
          <a
            href={match.maps_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-turf hover:underline"
            data-testid="maps-link"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Ver mapa
          </a>
        )}
      </div>
    </div>
  );
}
