import { z, type ZodSchema } from 'zod';
import { AppError } from './app-error.js';

export function parse<T>(schema: ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      result.error.flatten()
    );
  }
  return result.data;
}

export const uuid = z.string().uuid();
export const email = z.string().trim().toLowerCase().email().max(320);
