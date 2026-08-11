import { formatCentavos, parseAmountToCentavos } from '../../src/utils/money.js';

describe('money conversion', () => {
  test.each([
    ['1', 100],
    ['1.2', 120],
    ['1.23', 123],
    ['50000.00', 5000000]
  ])('%s parses to %s centavos', (input, expected) =>
    expect(parseAmountToCentavos(input)).toBe(expected)
  );
  test.each(['0', '-1', '1.234', '01.00', '1,000'])('rejects invalid amount %s', (input) =>
    expect(() => parseAmountToCentavos(input)).toThrow()
  );
  test('formats without floating point drift', () =>
    expect(formatCentavos(10000001)).toBe('100000.01'));
});
