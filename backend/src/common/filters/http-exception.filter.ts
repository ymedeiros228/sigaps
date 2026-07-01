import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

const GENERIC_EN = new Set([
  'internal server error',
  'internal server error.',
  'bad request',
  'not found',
  'forbidden',
  'unauthorized',
]);

function friendlyMessage(status: number, raw: string | string[] | undefined): string {
  const text = Array.isArray(raw) ? raw.join(', ') : (raw ?? '');
  const lower = text.trim().toLowerCase();

  if (text && !GENERIC_EN.has(lower)) return text;

  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'Dados inválidos. Verifique os campos e tente novamente.';
    case HttpStatus.UNAUTHORIZED:
      return 'Sessão expirada. Faça login novamente.';
    case HttpStatus.FORBIDDEN:
      return 'Você não tem permissão para esta ação.';
    case HttpStatus.NOT_FOUND:
      return 'Registro não encontrado.';
    case HttpStatus.CONFLICT:
      return 'Conflito ao salvar — o registro pode já existir.';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'Muitas requisições. Aguarde alguns segundos.';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'Servidor temporariamente indisponível. Tente novamente em instantes.';
    default:
      if (status >= 500) {
        return 'Erro no servidor. Tente novamente em instantes.';
      }
      return 'Não foi possível concluir a operação.';
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const raw =
        typeof body === 'string'
          ? body
          : typeof body === 'object' && body !== null && 'message' in body
            ? (body as { message?: string | string[] }).message
            : undefined;

      response.status(status).json({
        statusCode: status,
        message: friendlyMessage(status, raw),
      });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.message : String(exception),
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro inesperado no servidor. Tente novamente em instantes.',
    });
  }
}
