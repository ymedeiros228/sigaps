import { CACHE } from './queryKeys';
import { shouldRetryCloudQuery } from './queryRetry';

/** Defaults para queries de cadastro — falham rápido no Render. */
export const cadastrosQueryDefaults = {
  staleTime: CACHE.default,
  gcTime: 15 * 60_000,
  retry: (failureCount: number, error: unknown) =>
    failureCount < 2 && shouldRetryCloudQuery(failureCount, error),
  retryDelay: 1500,
  refetchOnWindowFocus: false,
} as const;
