export function getProfileId(user) {
  return user?.profile?.id || user?.profile_id || '';
}

export function getDisplayName(user) {
  return user?.profile?.name || user?.name || 'Jugador';
}
