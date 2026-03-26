import { isAdmin } from './user';

export function canManageGroup(group, user) {
  if (isAdmin(user)) return true;
  return group?.can_manage || group?.can_invite || group?.my_group_permission === 'organizador' || group?.my_member_role === 'organizador';
}

export function canInviteToGroup(group, user) {
  if (isAdmin(user)) return true;
  return Boolean(group?.can_invite || group?.my_group_permission === 'organizador' || group?.my_member_role === 'organizador');
}

export function canRateSeed(group, user) {
  if (isAdmin(user)) return true;
  return Boolean(group?.can_rate_seed || ['organizador', 'frecuente'].includes(group?.my_member_role));
}

export function canManageMatch(match, user) {
  if (isAdmin(user)) return true;
  return match?.my_group_role === 'organizador' || match?.organizer_id === user?.profile_id || match?.organizer_id === user?.profile?.id;
}
