import type { Knex } from 'knex';
import { MONEY } from '../../config/constants.js';
import type { LimitsRepository } from './limits.repository.js';
import { getLimitWindows } from '../../utils/date-boundaries.js';

export interface LimitUsage {
  dailyUsedCentavos: number;
  dailyRemainingCentavos: number;
  monthlyUsedCentavos: number;
  monthlyRemainingCentavos: number;
  dayStart: Date;
  monthStart: Date;
}

export function calculateRemaining(usedCentavos: number, limitCentavos: number) {
  return Math.max(0, limitCentavos - usedCentavos);
}

export class LimitService {
  constructor(
    private readonly transactions: LimitsRepository,
    private readonly db: Knex
  ) {}

  async usage(userId: string, trx: Knex | Knex.Transaction = this.db) {
    const windows = getLimitWindows();
    const daily = await this.transactions.sumCompleted(
      userId,
      windows.dayStart,
      windows.dayEnd,
      trx
    );
    const monthly = await this.transactions.sumCompleted(
      userId,
      windows.monthStart,
      windows.monthEnd,
      trx
    );
    return {
      dailyUsedCentavos: daily,
      dailyRemainingCentavos: calculateRemaining(daily, MONEY.dailyLimitCentavos),
      monthlyUsedCentavos: monthly,
      monthlyRemainingCentavos: calculateRemaining(monthly, MONEY.monthlyLimitCentavos),
      dayStart: windows.dayStart,
      monthStart: windows.monthStart
    };
  }

  async assertCanSpend(userId: string, amountCentavos: number, trx: Knex.Transaction) {
    const current = await this.usage(userId, trx);
    if (amountCentavos > current.dailyRemainingCentavos) throw new Error('DAILY_LIMIT_EXCEEDED');
    if (amountCentavos > current.monthlyRemainingCentavos)
      throw new Error('MONTHLY_LIMIT_EXCEEDED');
  }
}
