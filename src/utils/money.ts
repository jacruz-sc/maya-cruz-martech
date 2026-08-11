import { AppError } from './app-error.js';

const AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

export function parseAmountToCentavos(value: string): number {
  if (!AMOUNT_PATTERN.test(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Amount must be positive with at most 2 decimals');
  }
  const [whole = '0', decimal = ''] = value.split('.');
  const centavos = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(centavos) || centavos <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Amount must be a positive safe value');
  }
  return centavos;
}

export function formatCentavos(value: number | string): string {
  const centavos = Number(value);
  return (centavos / 100).toFixed(2);
}
