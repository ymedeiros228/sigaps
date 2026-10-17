import type { AxiosError } from 'axios';

type ApiErrorBody = {
  message?: string | { message?: string; code?: string };
  code?: string;
  statusCode?: number;
};

const GENERIC_EN = new Set([
  'internal server error',
  'internal server error.',
  'bad request',
  'not found',
  'forbidden',
  'unauthorized',
]);

function isGenericEnglishMessage(text: string) {
  return GENERIC_EN.has(text.trim().toLowerCase());
}

/** O navegador sabe dizer quando o aparelho está sem rede; fora isso, a falha é do servidor. */
export function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export const OFFLINE_MESSAGE =
  'Seu aparelho está sem internet. Conecte-se ao Wi-Fi ou aos dados móveis e tente novamente.';
const SERVER_UNAVAILABLE_MESSAGE =
  'O servidor está indisponível no momento. Tente novamente em alguns instantes.';
const SERVER_SLOW_MESSAGE = 'O servidor está lento agora. Aguarde um minuto e tente novamente.';
export const SERVER_DOWN_MESSAGE =
  'O servidor do SIGAPS não respondeu. Sua internet está funcionando: o problema é do nosso lado. Tente novamente em alguns instantes.';

export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro. Tente novamente.'): string {
  const err = error as AxiosError<ApiErrorBody>;
  const data = err.response?.data;
  if (!data) {
    if (isBrowserOffline()) return OFFLINE_MESSAGE;
    if (err.code === 'ECONNABORTED') {
      return 'O servidor demorou demais para responder. Tente novamente em alguns instantes.';
    }
    if (err.code === 'ERR_NETWORK') return SERVER_DOWN_MESSAGE;
    // 502/503/504 costumam vir sem corpo JSON (resposta do proxy, não da API).
    const status = err.response?.status;
    if (status === 503) return SERVER_UNAVAILABLE_MESSAGE;
    if (status === 502 || status === 504) return SERVER_SLOW_MESSAGE;
    return fallback;
  }

  if (typeof data.message === 'string') {
    const lower = data.message.trim().toLowerCase();
    if (lower.includes('throttler') || lower.includes('too many requests')) {
      return 'Muitas requisições em pouco tempo. Aguarde alguns segundos e continue pintando.';
    }
    if (!isGenericEnglishMessage(data.message)) {
      return data.message;
    }
  }

  if (data.message && typeof data.message === 'object') {
    const nested = data.message.message;
    if (nested && !isGenericEnglishMessage(nested)) return nested;
  }

  if (err.response?.status === 429) {
    return 'Muitas requisições em pouco tempo. Aguarde alguns segundos e continue pintando.';
  }

  if (err.response?.status === 403) {
    return 'Você não tem permissão para esta ação. Peça ajuda ao coordenador da APS.';
  }

  if (err.response?.status === 401) {
    return 'Sessão expirada. Faça login novamente.';
  }

  if (err.response?.status === 503) {
    return SERVER_UNAVAILABLE_MESSAGE;
  }

  if (err.response?.status === 500) {
    if (typeof data.message === 'string' && data.message.length > 0) {
      return data.message;
    }
    return 'Servidor temporariamente indisponível. Aguarde um momento e tente novamente.';
  }

  if (err.response?.status === 502 || err.response?.status === 504) {
    return SERVER_SLOW_MESSAGE;
  }

  return fallback;
}

export function getApiErrorCode(error: unknown): string | undefined {
  const err = error as AxiosError<ApiErrorBody>;
  const data = err.response?.data;
  if (!data) return undefined;
  if (data.code) return data.code;
  if (data.message && typeof data.message === 'object' && data.message.code) {
    return data.message.code;
  }
  return undefined;
}

export function isConflictError(error: unknown): boolean {
  return getApiErrorCode(error) === 'STREET_ALREADY_ASSIGNED';
}

export function getConflictMessage(error: unknown): string {
  const err = error as AxiosError<ApiErrorBody>;
  const data = err.response?.data;
  if (data?.message && typeof data.message === 'object' && data.message.message) {
    return data.message.message;
  }
  if (typeof data?.message === 'string') return data.message;
  return 'Esta rua já pertence a outra microárea.';
}
