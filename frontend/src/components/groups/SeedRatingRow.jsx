import React from 'react';

import { Input } from '../ui/input';
import { getGroupPermissionLabel, getMembershipTypeLabel } from '../../constants/groups';

export default function SeedRatingRow({ member, isInvitedByMe, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{member.player_name}</p>
        <p className="text-xs text-slate-500 truncate">
          {getGroupPermissionLabel(member.group_permission)}
          {' · '}
          {getMembershipTypeLabel(member.membership_type)}
          {member.membership_type === 'invitado' && isInvitedByMe ? ' · Tu invitado' : ''}
        </p>
      </div>

      <Input
        type="number"
        min="1"
        max="10"
        step="1"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 h-10 bg-slate-50"
      />
    </div>
  );
}
