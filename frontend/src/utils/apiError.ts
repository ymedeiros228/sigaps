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

export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro. Tente novamente.'): string {
  const err = error as AxiosError<ApiErrorBody>;
  const data = err.response?.data;
  if (!data) {
    if (err.code === 'ECONNABORTED') {
      return 'A requisição demorou demais. O servidor pode estar acordando — tente novamente.';
    }
    if (err.code === 'ERR_NETWORK') {
      return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
    }
    return fallback;
  }

  if (typeof data.message === 'string' && !isGenericEnglishMessage(data.message)) {
    return data.message;
  }

  if (data.message && typeof data.message === 'object') {
    const nested = data.message.message;
    if (nested && !isGenericEnglishMessage(nested)) return nested;
  }

  if (err.response?.status === 403) {
    return 'Você não tem permissão para esta ação. Peça ajuda ao coordenador da APS.';
  }

  if (err.response?.status === 401) {
    return 'Sessão expirada. Faça login novamente.';
  }

  if (err.response?.status === 503) {
    return 'Servidor acordando — aguarde alguns segundos e tente novamente.';
  }

  if (err.response?.status === 500) {
    return 'Servidor temporariamente indisponível. Aguarde um momento e tente novamente.';
  }

  if (err.response?.status === 502 || err.response?.status === 504) {
    return 'Servidor lento (hospedagem gratuita). Aguarde cerca de 1 minuto e tente novamente.';
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
