import { api } from '../services/api';
import { isRetryableQueryError, shouldRetryCloudQuery, cloudQueryRetryDelay } from './queryRetry';

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

/** Ping público sem token — evita falha quando JWT expirado durante cold start. */
async function pingHealth(timeoutMs = 15_000): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(WAKE_PATH, { signal: controller.signal, cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Aguarda a API responder (útil no cold start do Render). Sempre tenta seguir em frente. */
export async function waitForApiReady(maxAttempts = 15, intervalMs = 4000): Promise<boolean> {
  if (!isCloudDeployment()) return true;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (await pingHealth()) return true;
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return false;
}

export async function fetchDashboardIndicators(municipalityId: string) {
  const res = await api.get(`/dashboard/${municipalityId}`);
  const data = res.data;
  if (!data || typeof data !== 'object' || typeof data.streets !== 'number') {
    throw new Error('Resposta inválida do servidor');
  }
  return data;
}

export { isRetryableWakeError, isRetryableQueryError, shouldRetryCloudQuery, cloudQueryRetryDelay };
