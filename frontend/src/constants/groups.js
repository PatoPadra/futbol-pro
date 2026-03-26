export const GROUP_PERMISSION_LABELS = {
  organizador: 'Organizador',
  miembro: 'Miembro',
  admin: 'Admin',
};

export const MEMBERSHIP_TYPE_LABELS = {
  frecuente: 'Frecuente',
  invitado: 'Invitado',
};

export function getGroupPermissionLabel(permission) {
  return GROUP_PERMISSION_LABELS[permission] || permission || '—';
}

export function getMembershipTypeLabel(type) {
  return MEMBERSHIP_TYPE_LABELS[type] || type || '—';
}
