const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function assetUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
}
