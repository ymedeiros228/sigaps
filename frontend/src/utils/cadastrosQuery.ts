import { CACHE } from './queryKeys';
import { shouldRetryCloudQuery } from './queryRetry';

/** Padrões das consultas de cadastro: no máximo 1 nova tentativa, para o erro aparecer logo. */
export const cadastrosQueryDefaults = {
  staleTime: CACHE.default,
  gcTime: 15 * 60_000,
  retry: (failureCount: number, error: unknown) =>
    failureCount < 1 && shouldRetryCloudQuery(failureCount, error),
  retryDelay: 1000,
  refetchOnWindowFocus: false,
} as const;
