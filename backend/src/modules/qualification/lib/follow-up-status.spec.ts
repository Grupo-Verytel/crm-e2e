import mysql from 'mysql2/promise';
import { followUpStatusCase } from './follow-up-status';
import {
  followUpYellowLimit,
  readFollowUpYellowDays,
  resolveFollowUpStatus,
} from './follow-up-status';

const NOW = new Date('2026-10-17T15:00:00.000Z');
const YELLOW_DAYS = 2;

describe('readFollowUpYellowDays', () => {
  it('defaults to 2 and accepts zero', () => {
    expect(readFollowUpYellowDays(undefined)).toBe(2);
    expect(readFollowUpYellowDays('')).toBe(2);
    expect(readFollowUpYellowDays('0')).toBe(0);
    expect(readFollowUpYellowDays('2')).toBe(2);
  });

  it('rejects a negative or fractional value', () => {
    expect(() => readFollowUpYellowDays('-1')).toThrow(/integer >= 0/);
    expect(() => readFollowUpYellowDays('1.5')).toThrow(/integer >= 0/);
    expect(() => readFollowUpYellowDays('dos')).toThrow(/integer >= 0/);
  });
});

describe('resolveFollowUpStatus', () => {
  const limit = followUpYellowLimit(NOW, YELLOW_DAYS);

  it('is RED one minute before now', () => {
    expect(
      resolveFollowUpStatus(
        new Date(NOW.getTime() - 60_000),
        NOW,
        YELLOW_DAYS,
      ),
    ).toBe('RED');
  });

  it('is YELLOW at the exact current instant', () => {
    expect(resolveFollowUpStatus(NOW, NOW, YELLOW_DAYS)).toBe('YELLOW');
  });

  it('is YELLOW at 23:59 Bogota of the current Bogota day', () => {
    const todayAt2359Bogota = new Date('2026-10-18T04:59:00.000Z');
    expect(
      resolveFollowUpStatus(todayAt2359Bogota, NOW, YELLOW_DAYS),
    ).toBe('YELLOW');
  });

  it('is YELLOW on the exact end of day N and GREEN one minute later', () => {
    expect(resolveFollowUpStatus(limit, NOW, YELLOW_DAYS)).toBe('YELLOW');
    expect(
      resolveFollowUpStatus(
        new Date(limit.getTime() + 60_000),
        NOW,
        YELLOW_DAYS,
      ),
    ).toBe('GREEN');
  });

  it('is NONE when there is no open reminder', () => {
    expect(resolveFollowUpStatus(null, NOW, YELLOW_DAYS)).toBe('NONE');
  });

  it('uses the Bogota day when UTC has already rolled over', () => {
    const now = new Date('2026-10-18T01:00:00.000Z');
    const endOfBogotaDay = followUpYellowLimit(now, 0);
    expect(endOfBogotaDay.toISOString()).toBe('2026-10-18T04:59:59.999Z');
    expect(resolveFollowUpStatus(endOfBogotaDay, now, 0)).toBe('YELLOW');
    expect(
      resolveFollowUpStatus(new Date('2026-10-18T05:00:00.000Z'), now, 0),
    ).toBe('GREEN');
  });
});

describe('follow-up SQL matches resolveFollowUpStatus', () => {
  const cases: Array<{ label: string; next: Date | null; now: Date; days: number }> =
    [
      {
        label: 'one minute overdue',
        next: new Date(NOW.getTime() - 60_000),
        now: NOW,
        days: YELLOW_DAYS,
      },
      { label: 'exactly now', next: NOW, now: NOW, days: YELLOW_DAYS },
      {
        label: '23:59 Bogota today',
        next: new Date('2026-10-18T04:59:00.000Z'),
        now: NOW,
        days: YELLOW_DAYS,
      },
      {
        label: 'exact yellow limit',
        next: followUpYellowLimit(NOW, YELLOW_DAYS),
        now: NOW,
        days: YELLOW_DAYS,
      },
      {
        label: 'one minute after the yellow limit',
        next: new Date(followUpYellowLimit(NOW, YELLOW_DAYS).getTime() + 60_000),
        now: NOW,
        days: YELLOW_DAYS,
      },
      { label: 'no reminder', next: null, now: NOW, days: YELLOW_DAYS },
      {
        label: 'Bogota evening that is the next UTC day',
        next: new Date('2026-10-18T05:00:00.000Z'),
        now: new Date('2026-10-18T01:00:00.000Z'),
        days: 0,
      },
    ];

  it.each(cases)('$label', async ({ next, now, days }) => {
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
        `SELECT ${followUpStatusCase(':next')} AS follow_up_status`,
        {
          next,
          now,
          yellowLimit: followUpYellowLimit(now, days),
        },
      );
      const status = (rows as Array<{ follow_up_status: string }>)[0]
        .follow_up_status;
      expect(status).toBe(resolveFollowUpStatus(next, now, days));
    } finally {
      await connection.end();
    }
  });
});
