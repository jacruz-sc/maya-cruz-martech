import { DateTime } from 'luxon';
import { MONEY } from '../config/constants.js';

export interface LimitWindows {
  now: Date;
  dayStart: Date;
  dayEnd: Date;
  monthStart: Date;
  monthEnd: Date;
}

export function getLimitWindows(now = new Date()): LimitWindows {
  const pht = DateTime.fromJSDate(now, { zone: 'utc' }).setZone(MONEY.timezone);
  return {
    now,
    dayStart: pht.startOf('day').toUTC().toJSDate(),
    dayEnd: pht.plus({ days: 1 }).startOf('day').toUTC().toJSDate(),
    monthStart: pht.startOf('month').toUTC().toJSDate(),
    monthEnd: pht.plus({ months: 1 }).startOf('month').toUTC().toJSDate()
  };
}
