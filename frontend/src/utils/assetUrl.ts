import { MUNICIPALITY_LOGO } from '../constants/branding';

const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? '' : 'http://localhost:3000');

export function assetUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
}

/** Prefer logo estático do frontend quando for o brasão padrão (evita /uploads quebrado no Render). */
export function resolveMunicipalityLogoSrc(logoUrl?: string | null): string {
  if (!logoUrl) return MUNICIPALITY_LOGO;
  if (/passagem-franca|prefeitura/i.test(logoUrl)) return MUNICIPALITY_LOGO;
  return assetUrl(logoUrl) ?? MUNICIPALITY_LOGO;
}
