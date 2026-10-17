import { describe, expect, it } from 'vitest';
import { cloudQueryRetryDelay, isRetryableQueryError, shouldRetryCloudQuery } from './queryRetry';

// Erro no formato do axios: com resposta (status) ou só com código de rede.
const httpError = (status: number) => ({ response: { status } });
const networkError = (code: string) => ({ code });

describe('novas tentativas das consultas', () => {
  it('espera 1 s, 2 s e 4 s entre as tentativas', () => {
    expect(cloudQueryRetryDelay(0)).toBe(1_000);
    expect(cloudQueryRetryDelay(1)).toBe(2_000);
    expect(cloudQueryRetryDelay(2)).toBe(4_000);
    expect(cloudQueryRetryDelay(5)).toBe(4_000);
  });

  it('tenta de novo quando a rede cai, o tempo esgota ou o servidor está fora (502–504)', () => {
    expect(isRetryableQueryError(networkError('ERR_NETWORK'))).toBe(true);
    expect(isRetryableQueryError(networkError('ECONNABORTED'))).toBe(true);
    expect(isRetryableQueryError(httpError(502))).toBe(true);
    expect(isRetryableQueryError(httpError(503))).toBe(true);
    expect(isRetryableQueryError(httpError(504))).toBe(true);
  });

  it('não tenta de novo em erro 4xx nem em 500', () => {
    for (const status of [400, 401, 403, 404, 408, 409, 422, 429, 500]) {
      expect(isRetryableQueryError(httpError(status))).toBe(false);
    }
  });

  it('para depois de 3 novas tentativas', () => {
    const err = networkError('ERR_NETWORK');
    expect(shouldRetryCloudQuery(0, err)).toBe(true);
    expect(shouldRetryCloudQuery(2, err)).toBe(true);
    expect(shouldRetryCloudQuery(3, err)).toBe(false);
  });
});
