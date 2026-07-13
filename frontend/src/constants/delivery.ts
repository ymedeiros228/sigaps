export const LEGACY_DOWNLOAD_FILENAME = 'sigaps-legado-passagem-franca.zip';

/** Download direto do ZIP na raiz do site (não passa pelo app React/PWA). */
export const LEGACY_DOWNLOAD_PATH = `/${LEGACY_DOWNLOAD_FILENAME}`;

export const LEGACY_DOWNLOAD_URL = `https://sigaps-api.onrender.com${LEGACY_DOWNLOAD_PATH}`;

export function legacyDownloadShareUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${LEGACY_DOWNLOAD_PATH}`;
  }
  return LEGACY_DOWNLOAD_URL;
}
