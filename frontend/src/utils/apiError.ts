import type { AxiosError } from 'axios';

type ApiErrorBody = {
  message?: string | { message?: string; code?: string };
  code?: string;
  statusCode?: number;
};

export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro. Tente novamente.'): string {
  const err = error as AxiosError<ApiErrorBody>;
  const data = err.response?.data;
  if (!data) return fallback;

  if (typeof data.message === 'string') return data.message;

  if (data.message && typeof data.message === 'object') {
    if (data.message.message) return data.message.message;
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
