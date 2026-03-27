import { API_URL } from '@/lib/api';

export function buildPhotoUrl(photoUrl) {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('http')) return photoUrl;
  return `${API_URL}${photoUrl}`;
}

export function initialsFromName(name) {
  if (!name) return '??';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}
