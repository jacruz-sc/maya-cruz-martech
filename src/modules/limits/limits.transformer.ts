import { formatCentavos } from '../../utils/money.js';
import type { LimitUsage } from './service.js';

export function transformLimitUsage(usage: LimitUsage) {
  return {
    currency: 'PHP',
    timezone: 'Asia/Manila',
    daily: {
      limit: '50000.00',
      used: formatCentavos(usage.dailyUsedCentavos),
      remaining: formatCentavos(usage.dailyRemainingCentavos),
      startsAt: usage.dayStart.toISOString()
    },
    monthly: {
      limit: '500000.00',
      used: formatCentavos(usage.monthlyUsedCentavos),
      remaining: formatCentavos(usage.monthlyRemainingCentavos),
      startsAt: usage.monthStart.toISOString()
    }
  };
}
