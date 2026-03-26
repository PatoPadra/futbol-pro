import React from 'react';

import { Input } from '../ui/input';
import { GROUP_PERMISSION_LABELS, MEMBERSHIP_TYPE_LABELS } from '../../constants/groups';

export default function SeedRatingRow({ member, value, onChange, myProfileId }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm shadow-slate-100/50">
      <div>
        <p className="font-medium text-slate-900">{member.player_name}</p>
        <p className="text-xs text-slate-500">
          {GROUP_PERMISSION_LABELS[member.group_permission] || member.group_permission}
          {' · '}
          {MEMBERSHIP_TYPE_LABELS[member.membership_type] || member.membership_type}
          {member.membership_type === 'invitado' && member.invited_by === myProfileId ? ' · Tu invitado' : ''}
        </p>
      </div>

      <Input
        type="number"
        min="1"
        max="10"
        step="1"
        value={value || ''}
        onChange={onChange}
        className="w-24 h-10 bg-slate-50"
      />
    </div>
  );
}
