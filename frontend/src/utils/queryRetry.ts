import type { AxiosError } from 'axios';

export function isRetryableQueryError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const err = error as AxiosError;
  const status = err.response?.status;
  const code = err.code;

  if (code === 'ECONNABORTED' || code === 'ERR_NETWORK') return true;
  if (!status) return true;
  // 429: não retry (piora o throttle). 500 genérico também costuma ser ruído.
  if (status === 408 || status === 503) return true;
  if (status >= 502 && status <= 504) return true;
  return false;
}

export function cloudQueryRetryDelay(attemptIndex: number) {
  // 502/cold start: espera maior entre tentativas
  return Math.min(30_000, 3_000 * 2 ** attemptIndex);
}

export function shouldRetryCloudQuery(failureCount: number, error: unknown) {
  return failureCount < 3 && isRetryableQueryError(error);
}
