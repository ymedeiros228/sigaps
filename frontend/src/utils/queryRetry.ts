import type { AxiosError } from 'axios';

/** Número máximo de novas tentativas depois da primeira falha. */
const MAX_RETRIES = 3;
/** Espera da 1ª nova tentativa; dobra a cada vez (1 s → 2 s → 4 s). */
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 4_000;

/**
 * Só vale tentar de novo quando a falha pode passar sozinha: sem resposta
 * (rede caiu, tempo esgotado) ou servidor fora do ar (502, 503, 504).
 * Erro 4xx (dados inválidos, sem permissão, não encontrado, 429) não muda
 * repetindo o pedido — mostra o erro logo.
 */
export function isRetryableQueryError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const err = error as AxiosError;
  const status = err.response?.status;
  const code = err.code;

  if (code === 'ECONNABORTED' || code === 'ERR_NETWORK') return true;
  if (!status) return true;
  return status >= 502 && status <= 504;
}

/** Espera antes da nova tentativa: 1 s, 2 s, 4 s. */
export function cloudQueryRetryDelay(attemptIndex: number) {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attemptIndex);
}

export function shouldRetryCloudQuery(failureCount: number, error: unknown) {
  return failureCount < MAX_RETRIES && isRetryableQueryError(error);
}
