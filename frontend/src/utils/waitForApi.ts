import { api } from '../services/api';

const WAKE_PATH = '/health';

function isCloudDeployment() {
  if (!import.meta.env.PROD) return false;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

function isRetryableWakeError(error: unknown) {
  if (!error || typeof error !== 'object') return true;
  const err = error as { code?: string; response?: { status?: number } };
  if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') return true;
  const status = err.response?.status;
  return !status || status >= 502;
}

/** Aguarda a API responder (útil no cold start do Render). */
export async function waitForApiReady(maxAttempts = 12, intervalMs = 5000): Promise<boolean> {
  if (!isCloudDeployment()) return true;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await api.get(WAKE_PATH, { timeout: 15_000 });
      return true;
    } catch (error) {
      if (!isRetryableWakeError(error) || attempt === maxAttempts - 1) {
        return false;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return false;
}
