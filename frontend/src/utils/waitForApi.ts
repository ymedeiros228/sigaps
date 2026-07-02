import { api } from '../services/api';
import { isRetryableQueryError, shouldRetryCloudQuery, cloudQueryRetryDelay } from './queryRetry';

const PRODUCTION_API_URL = 'https://sigaps-api.onrender.com';

function apiBaseUrl(): string {
  return (
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? PRODUCTION_API_URL : 'http://localhost:3000')
  ).replace(/\/$/, '');
}

function apiHealthUrl(): string {
  const base = apiBaseUrl();
  return base ? `${base}/health` : '/health';
}

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

/** Ping público na API (não no host do frontend) — acorda o Render no cold start. */
async function pingHealth(timeoutMs = 15_000): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiHealthUrl(), { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') ?? '';
    return contentType.includes('application/json');
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Aguarda a API responder (útil no cold start do Render). Sempre tenta seguir em frente. */
export async function waitForApiReady(
  maxAttempts = 15,
  intervalMs = 4000,
  onProgress?: (attempt: number, maxAttempts: number) => void,
): Promise<boolean> {
  if (!isCloudDeployment()) return true;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    onProgress?.(attempt + 1, maxAttempts);
    if (await pingHealth()) return true;
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return false;
}

/** Ping periódico enquanto o app está aberto (reduz cold start no Render). */
export function startApiKeepAlive(intervalMs = 8 * 60 * 1000): () => void {
  if (!isCloudDeployment()) return () => {};

  void pingHealth(10_000);
  const id = window.setInterval(() => void pingHealth(10_000), intervalMs);
  return () => window.clearInterval(id);
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
