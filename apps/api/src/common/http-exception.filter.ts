import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@kleps/db';
import { ERROR_CODES, type ApiErrorBody } from '@kleps/shared';
import type { Response } from 'express';
import { AppError } from './errors';

const STATUS_CODES: Partial<Record<number, string>> = {
  400: ERROR_CODES.VALIDATION_ERROR,
  401: ERROR_CODES.UNAUTHORIZED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  413: ERROR_CODES.FILE_TOO_LARGE,
  415: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
  429: ERROR_CODES.RATE_LIMITED,
};

/** Converts every error into the uniform `{ statusCode, error, message, issues? }` shape. Never leaks internals. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof AppError) {
      const base = exception.getResponse() as ApiErrorBody;
      return exception.details ? { ...base, issues: exception.details as ApiErrorBody['issues'] } : base;
    }
    if (exception instanceof ThrottlerException) {
      return { statusCode: 429, error: ERROR_CODES.RATE_LIMITED, message: 'Too many requests' };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      const message =
        typeof resp === 'string' ? resp : String((resp as { message?: unknown }).message ?? exception.message);
      // Multer reports size violations as 413 PayloadTooLarge.
      return { statusCode: status, error: STATUS_CODES[status] ?? ERROR_CODES.INTERNAL_ERROR, message };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return { statusCode: 409, error: ERROR_CODES.CONFLICT, message: 'Already exists' };
      if (exception.code === 'P2025') return { statusCode: 404, error: ERROR_CODES.NOT_FOUND, message: 'Not found' };
    }
    if (exception && typeof exception === 'object' && 'type' in exception && exception.type === 'entity.parse.failed') {
      return { statusCode: 400, error: ERROR_CODES.VALIDATION_ERROR, message: 'Malformed JSON body' };
    }
    if (exception && typeof exception === 'object' && 'type' in exception && exception.type === 'entity.too.large') {
      return { statusCode: 413, error: ERROR_CODES.FILE_TOO_LARGE, message: 'Request body too large' };
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, error: ERROR_CODES.INTERNAL_ERROR, message: 'Internal error' };
  }
}
