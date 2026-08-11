import { AppError } from '../../src/utils/app-error.js';

test('AppError retains stable API error metadata', () => {
  const error = new AppError(422, 'DAILY_LIMIT_EXCEEDED', 'Daily spending limit exceeded');
  expect(error.statusCode).toBe(422);
  expect(error.code).toBe('DAILY_LIMIT_EXCEEDED');
});
