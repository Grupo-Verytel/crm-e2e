import { remindAtFromEvent } from './reminders.service';

describe('remindAtFromEvent', () => {
  it('keeps the same clock time N calendar days earlier', () => {
    const eventAt = new Date('2026-10-02T15:00:00.000Z');
    expect(remindAtFromEvent(eventAt, 0).toISOString()).toBe(
      '2026-10-02T15:00:00.000Z',
    );
    expect(remindAtFromEvent(eventAt, 2).toISOString()).toBe(
      '2026-09-30T15:00:00.000Z',
    );
  });
});
