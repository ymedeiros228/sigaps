import type { AxiosError } from 'axios';

export function isRetryableQueryError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const err = error as AxiosError;
  const status = err.response?.status;
  const code = err.code;

  if (code === 'ECONNABORTED' || code === 'ERR_NETWORK') return true;
  if (!status) return true;
  if (status === 408 || status === 429) return true;
  if (status >= 502 && status <= 504) return true;
  return false;
}

export function cloudQueryRetryDelay(attemptIndex: number) {
  return Math.min(60_000, 2_000 * 2 ** attemptIndex);
}

export function shouldRetryCloudQuery(failureCount: number, error: unknown) {
  return failureCount < 6 && isRetryableQueryError(error);
}
