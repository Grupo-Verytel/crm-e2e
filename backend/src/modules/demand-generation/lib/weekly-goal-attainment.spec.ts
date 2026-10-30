import {
  fiscalQuarterDayCount,
  weeklyGoalAttainment,
  type WeeklyGoalRow,
} from './weekly-goal-attainment';

function range(from: string, toExclusive: string) {
  return {
    start: new Date(`${from}T05:00:00.000Z`),
    end: new Date(`${toExclusive}T05:00:00.000Z`),
  };
}

function row(
  fiscalYear: number,
  quarter: number,
  weeklyTarget: number,
  metric = 'INTERACTIONS',
): WeeklyGoalRow {
  return { fiscalYear, quarter, metric, weeklyTarget };
}

describe('weeklyGoalAttainment', () => {
  it('P1: a full week inside one quarter equals the weekly target', () => {
    const result = weeklyGoalAttainment({
      range: range('2026-05-04', '2026-05-11'),
      metric: 'INTERACTIONS',
      rows: [row(2026, 2, 10), row(2026, 2, 99, 'LEADS')],
      actual: 5,
    });
    expect(result).toEqual({ actual: 5, target: 10, attainment_pct: 50 });
  });

  it('P2: a week crossing Q3 into Q4 sums each quarter by its days', () => {
    const result = weeklyGoalAttainment({
      range: range('2026-10-28', '2026-11-04'),
      metric: 'INTERACTIONS',
      rows: [row(2026, 3, 10), row(2026, 4, 8)],
      actual: 5,
    });
    expect(result).toEqual({ actual: 5, target: 9, attainment_pct: 56 });
  });

  it('P3: a week from December into January stays on Q4 of the same fiscal year', () => {
    const result = weeklyGoalAttainment({
      range: range('2026-12-28', '2027-01-04'),
      metric: 'INTERACTIONS',
      rows: [row(2026, 4, 14), row(2027, 1, 99)],
      actual: 7,
    });
    expect(result).toEqual({ actual: 7, target: 14, attainment_pct: 50 });
  });

  it('P4: a week from January into February uses each fiscal year', () => {
    const result = weeklyGoalAttainment({
      range: range('2027-01-27', '2027-02-03'),
      metric: 'INTERACTIONS',
      rows: [row(2026, 4, 7), row(2027, 1, 14)],
      actual: 18,
    });
    expect(result).toEqual({ actual: 18, target: 9, attainment_pct: 200 });
  });

  it('P5: a slice without a goal adds zero', () => {
    const result = weeklyGoalAttainment({
      range: range('2026-10-28', '2026-11-04'),
      metric: 'INTERACTIONS',
      rows: [row(2026, 3, 7)],
      actual: 2,
    });
    expect(result).toEqual({ actual: 2, target: 4, attainment_pct: 50 });
  });

  it('P6: without an active range the target stays null', () => {
    const result = weeklyGoalAttainment({
      range: null,
      metric: 'INTERACTIONS',
      rows: [row(2026, 2, 10)],
      actual: 0,
    });
    expect(result).toEqual({ actual: 0, target: null, attainment_pct: null });
  });

  it('P7: a stored zero makes the total target zero', () => {
    const result = weeklyGoalAttainment({
      range: range('2026-05-04', '2026-05-11'),
      metric: 'INTERACTIONS',
      rows: [row(2026, 2, 0)],
      actual: 4,
    });
    expect(result).toEqual({ actual: 4, target: 0, attainment_pct: null });
  });

  it('P8: actual above the target is not capped', () => {
    const result = weeklyGoalAttainment({
      range: range('2026-05-04', '2026-05-11'),
      metric: 'INTERACTIONS',
      rows: [row(2026, 2, 10)],
      actual: 25,
    });
    expect(result).toEqual({ actual: 25, target: 10, attainment_pct: 250 });
  });

  it('counts quarter length from the Verytel calendar', () => {
    expect(fiscalQuarterDayCount(2026, 1)).toBe(89);
    expect(fiscalQuarterDayCount(2024, 1)).toBe(90);
    expect(fiscalQuarterDayCount(2026, 4)).toBe(92);
  });
});
