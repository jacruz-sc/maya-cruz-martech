import { MONEY } from '../../src/config/constants.js';
import { calculateRemaining } from '../../src/modules/limits/service.js';

describe('inclusive spending limits', () => {
  test('allows exactly the remaining amount', () =>
    expect(calculateRemaining(4_999_900, MONEY.dailyLimitCentavos)).toBe(100));
  test('returns zero at the cap', () =>
    expect(calculateRemaining(MONEY.dailyLimitCentavos, MONEY.dailyLimitCentavos)).toBe(0));
  test('never returns negative remaining usage', () =>
    expect(calculateRemaining(5_000_001, MONEY.dailyLimitCentavos)).toBe(0));
  test('monthly limit is PHP 500,000', () => expect(MONEY.monthlyLimitCentavos).toBe(50_000_000));
});
