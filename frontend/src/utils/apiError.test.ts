import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from './apiError';

describe('mensagem de erro da API', () => {
  it('502/503/504 sem corpo (resposta do proxy) dizem que o problema é o servidor', () => {
    expect(getApiErrorMessage({ response: { status: 503, data: '' } })).toMatch(/indisponível/);
    expect(getApiErrorMessage({ response: { status: 502, data: '' } })).toMatch(/lento/);
    expect(getApiErrorMessage({ response: { status: 504 } })).toMatch(/lento/);
  });

  it('não fala mais em servidor "acordando"', () => {
    expect(getApiErrorMessage({ response: { status: 503, data: {} } })).not.toMatch(/acord/i);
  });

  it('erro sem status conhecido usa o texto da tela', () => {
    expect(getApiErrorMessage({ response: { status: 418 } }, 'Falhou.')).toBe('Falhou.');
  });
});
