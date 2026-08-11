import type { FastifyRequest } from 'fastify';
import { AppError } from '../utils/app-error.js';

export function transformError(error: unknown, request: FastifyRequest) {
  const appError =
    error instanceof AppError
      ? error
      : new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  return {
    statusCode: appError.statusCode,
    body: {
      error: {
        code: appError.code,
        message: appError.message,
        requestId: request.id,
        ...(appError.details ? { details: appError.details } : {})
      }
    }
  };
}
