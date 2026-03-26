import React from 'react';
import { Shield } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { GROUP_PERMISSION_LABELS, MEMBERSHIP_TYPE_LABELS } from '../../constants/groups';
import { API_URL } from '../../lib/api';

export default function GroupMemberCard({ member }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm shadow-slate-100/60">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="w-11 h-11 border border-slate-100">
          <AvatarImage src={member.photo_url ? `${API_URL}${member.photo_url}` : undefined} />
          <AvatarFallback className="bg-turf/10 text-turf text-xs font-bold">
            {member.player_name?.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <p className="font-medium truncate text-slate-900">{member.player_name}</p>
          <p className="text-xs text-slate-500 truncate">
            {member.player_email || 'Sin email'}
            {member.primary_position ? ` · ${member.primary_position}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Badge variant="outline">
          {GROUP_PERMISSION_LABELS[member.group_permission] || member.group_permission || member.member_role}
        </Badge>
        <Badge variant="outline">
          {MEMBERSHIP_TYPE_LABELS[member.membership_type] || member.membership_type || member.player_type}
        </Badge>
        {member.is_system_admin && (
          <Badge className="bg-slate-900 text-white">
            <Shield className="w-3 h-3 mr-1" /> Admin
          </Badge>
        )}
      </div>
    </div>
  );
}
