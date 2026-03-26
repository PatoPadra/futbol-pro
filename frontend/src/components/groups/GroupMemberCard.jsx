import React from 'react';
import { Shield } from 'lucide-react';

import { Badge } from '../ui/badge';
import { getGroupPermissionLabel, getMembershipTypeLabel } from '../../constants/groups';

export default function GroupMemberCard({ member }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{member.player_name}</p>
        <p className="text-xs text-slate-500 truncate">
          {member.player_email || 'Sin email'}
          {member.primary_position ? ` · ${member.primary_position}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Badge variant="outline">{getGroupPermissionLabel(member.group_permission)}</Badge>
        <Badge variant="outline">{getMembershipTypeLabel(member.membership_type)}</Badge>

        {member.is_system_admin && (
          <Badge className="bg-slate-900 text-white">
            <Shield className="w-3 h-3 mr-1" /> Admin
          </Badge>
        )}
      </div>
    </div>
  );
}
