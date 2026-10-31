import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '@kleps/shared';

/** HTTP error with a stable machine-readable code (see ERROR_CODES). */
export class AppError extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: unknown,
  ) {
    super({ statusCode: status, error: code, message: message ?? code }, status);
  }
}

export const Errors = {
  notFound: (what = 'Resource') => new AppError(HttpStatus.NOT_FOUND, ERROR_CODES.NOT_FOUND, `${what} not found`),
  forbidden: (msg = 'Forbidden') => new AppError(HttpStatus.FORBIDDEN, ERROR_CODES.FORBIDDEN, msg),
  unauthorized: (msg = 'Authentication required') => new AppError(HttpStatus.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, msg),
  conflict: (code: ErrorCode, msg?: string) => new AppError(HttpStatus.CONFLICT, code, msg),
  badRequest: (code: ErrorCode, msg?: string, details?: unknown) => new AppError(HttpStatus.BAD_REQUEST, code, msg, details),
  invalidState: (msg: string) => new AppError(HttpStatus.CONFLICT, ERROR_CODES.LISTING_INVALID_STATE, msg),
};
