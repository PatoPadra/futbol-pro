import React from 'react';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { API_URL } from '../../lib/api';

export default function RegistrationListCard({ title, dotClassName, emptyLabel, rows, testIdPrefix }) {
  return (
    <Card className="border-slate-100 shadow-sm shadow-slate-100/70">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${dotClassName}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">{emptyLabel}</p>}

        {rows.map((row, index) => (
          <div
            key={row.id}
            className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
            data-testid={`${testIdPrefix}-${row.player_id}`}
          >
            <span className="text-xs font-bold text-slate-400 w-5">{index + 1}</span>

            <Avatar className="w-9 h-9 border border-slate-100">
              <AvatarImage src={row.player_photo ? `${API_URL}${row.player_photo}` : undefined} />
              <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-bold">
                {row.player_name?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <Link
                to={`/jugadores/${row.player_id}`}
                className="text-sm font-medium text-slate-900 hover:text-turf-accessible truncate block"
              >
                {row.player_name}
              </Link>
              {row.primary_position && <span className="text-xs text-slate-400">{row.primary_position}</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
