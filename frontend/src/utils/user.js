export function getProfileId(user) {
  return user?.profile?.id || user?.profile_id || '';
}

export function getUserDisplayName(user) {
  return user?.profile?.name || user?.name || 'Jugador';
}

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function canCreateGroupsAndMatches(user) {
  return user?.role === 'organizador' || isAdmin(user);
}
