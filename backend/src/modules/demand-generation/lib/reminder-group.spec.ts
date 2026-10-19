import mysql from 'mysql2/promise';
import { bogotaDayEnd } from '../../../common/time/bogota-day';
import { reminderGroupCase, resolveReminderGroup } from './reminder-group';

const NOW = new Date('2026-10-17T15:00:00.000Z');

describe('resolveReminderGroup', () => {
  it('is OVERDUE one minute before now', () => {
    expect(
      resolveReminderGroup(new Date(NOW.getTime() - 60_000), NOW),
    ).toBe('OVERDUE');
  });

  it('is TODAY at the exact current instant', () => {
    expect(resolveReminderGroup(NOW, NOW)).toBe('TODAY');
  });

  it('is TODAY at 23:59 Bogota and UPCOMING at 00:00 the next Bogota day', () => {
    expect(resolveReminderGroup(new Date('2026-10-18T04:59:00.000Z'), NOW)).toBe(
      'TODAY',
    );
    expect(bogotaDayEnd(NOW).toISOString()).toBe('2026-10-18T04:59:59.999Z');
    expect(resolveReminderGroup(new Date('2026-10-18T05:00:00.000Z'), NOW)).toBe(
      'UPCOMING',
    );
  });

  it('uses the Bogota day when UTC has already rolled over', () => {
    const now = new Date('2026-10-18T01:00:00.000Z');
    expect(resolveReminderGroup(now, now)).toBe('TODAY');
    expect(resolveReminderGroup(bogotaDayEnd(now), now)).toBe('TODAY');
    expect(
      resolveReminderGroup(new Date('2026-10-18T05:00:00.000Z'), now),
    ).toBe('UPCOMING');
    expect(
      resolveReminderGroup(new Date(now.getTime() - 60_000), now),
    ).toBe('OVERDUE');
  });
});

describe('reminder group SQL matches resolveReminderGroup', () => {
  const cases: Array<{ label: string; eventAt: Date; now: Date }> = [
    {
      label: 'one minute overdue',
      eventAt: new Date(NOW.getTime() - 60_000),
      now: NOW,
    },
    { label: 'exactly now', eventAt: NOW, now: NOW },
    {
      label: '23:59 Bogota',
      eventAt: new Date('2026-10-18T04:59:00.000Z'),
      now: NOW,
    },
    {
      label: '00:00 Bogota next day',
      eventAt: new Date('2026-10-18T05:00:00.000Z'),
      now: NOW,
    },
    {
      label: '20:00 Bogota is 01:00 UTC',
      eventAt: new Date('2026-10-18T05:00:00.000Z'),
      now: new Date('2026-10-18T01:00:00.000Z'),
    },
  ];

  it.each(cases)('$label', async ({ eventAt, now }) => {
    require('dotenv').config();
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      namedPlaceholders: true,
      timezone: 'Z',
    });
    try {
      const [rows] = await connection.query(
        `SELECT ${reminderGroupCase(':eventAt')} AS reminder_group`,
        { eventAt, now, todayEnd: bogotaDayEnd(now) },
      );
      const group = (rows as Array<{ reminder_group: string }>)[0]
        .reminder_group;
      expect(group).toBe(resolveReminderGroup(eventAt, now));
    } finally {
      await connection.end();
    }
  });
});
