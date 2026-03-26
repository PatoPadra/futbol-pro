export function isAdmin(user) {
  return user?.role === 'admin';
}

export function isOrganizerRole(user) {
  return user?.role === 'organizador' || user?.role === 'admin';
}

export function canManageGroup(group, user) {
  return isAdmin(user) || !!group?.can_manage || group?.my_group_permission === 'organizador';
}

export function canInviteToGroup(group, user) {
  return isAdmin(user) || !!group?.can_invite;
}

export function canRateSeed(group, user) {
  return isAdmin(user) || !!group?.can_rate_seed;
}

export function canManageMatch(match, user) {
  return isAdmin(user) || match?.my_group_role === 'organizador';
}
