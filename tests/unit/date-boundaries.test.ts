import { DateTime } from 'luxon';
import { getLimitWindows } from '../../src/utils/date-boundaries.js';

test('uses Asia/Manila calendar boundaries around UTC midnight', () => {
  const now = new Date('2026-08-11T16:30:00.000Z');
  const windows = getLimitWindows(now);
  expect(windows.dayStart.toISOString()).toBe('2026-08-11T16:00:00.000Z');
  expect(windows.monthStart.toISOString()).toBe('2026-07-31T16:00:00.000Z');
  expect(DateTime.fromJSDate(windows.dayEnd, { zone: 'utc' }).toISO()).toBe(
    '2026-08-12T16:00:00.000Z'
  );
});

test('resets monthly usage at the start of the next PHT month', () => {
  const windows = getLimitWindows(new Date('2026-08-31T15:59:59.000Z'));
  expect(windows.monthEnd.toISOString()).toBe('2026-08-31T16:00:00.000Z');
});
