import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { isTransientDbError } from '../utils/prisma-retry.util';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError
      | Prisma.PrismaClientInitializationError
      | Prisma.PrismaClientUnknownRequestError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (isTransientDbError(exception)) {
      this.logger.warn(`DB transitório: ${exception.message}`);
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Banco de dados ocupado — tente novamente em instantes.',
      });
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado',
        });
        return;
      }

      if (exception.code === 'P2002') {
        const target = exception.meta?.target;
        const fields = Array.isArray(target) ? target.map(String) : [];
        const isCnesConflict =
          fields.some((f) => f.includes('cnes_code')) ||
          String(exception.message).includes('ubs_cnes_code');
        response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: isCnesConflict
            ? 'Já existe uma UBS com este código CNES neste município.'
            : 'Conflito ao salvar — o registro pode já existir.',
          code: isCnesConflict ? 'UBS_CNES_DUPLICATE' : 'UNIQUE_CONSTRAINT',
        });
        return;
      }

      if (
        exception.code === 'P2022' ||
        (exception.message.includes('column') && exception.message.includes('does not exist'))
      ) {
        this.logger.error(`Schema desatualizado: ${exception.message}`);
        response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message:
            'Banco de dados desatualizado — aguarde a conclusão da migração e tente novamente.',
          code: 'DB_SCHEMA_OUTDATED',
        });
        return;
      }
    }

    this.logger.error(exception.message, exception.stack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro ao acessar o banco de dados',
    });
  }
}
