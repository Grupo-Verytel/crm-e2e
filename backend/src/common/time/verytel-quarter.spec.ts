import { bogotaDayEnd, bogotaDayStart } from './bogota-day';
import {
  formatVerytelQuarterRange,
  isVerytelQuarterFinished,
  verytelQuarterOf,
  verytelQuarterRange,
} from './verytel-quarter';

/** Wall-clock in America/Bogota (UTC−5, no DST). */
function bogota(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month, day, hour + 5, minute, 0));
}

describe('verytel quarter', () => {
  it('REQ-05: 31 Jan belongs to Q4 of the previous fiscal year', () => {
    expect(verytelQuarterOf(bogota(2027, 0, 31, 23, 59))).toEqual({
      fiscalYear: 2026,
      quarter: 4,
    });
  });

  it('REQ-05: 1 Feb opens Q1 of that fiscal year', () => {
    expect(verytelQuarterOf(bogota(2027, 1, 1, 0, 0))).toEqual({
      fiscalYear: 2027,
      quarter: 1,
    });
  });

  it('REQ-05: 30 Apr is still Q1 and 1 May is Q2', () => {
    expect(verytelQuarterOf(bogota(2026, 3, 30, 23, 59))).toEqual({
      fiscalYear: 2026,
      quarter: 1,
    });
    expect(verytelQuarterOf(bogota(2026, 4, 1, 0, 0))).toEqual({
      fiscalYear: 2026,
      quarter: 2,
    });
  });

  it('REQ-05: 31 Jul is Q2 and 1 Aug is Q3', () => {
    expect(verytelQuarterOf(bogota(2026, 6, 31, 23, 59))).toEqual({
      fiscalYear: 2026,
      quarter: 2,
    });
    expect(verytelQuarterOf(bogota(2026, 7, 1, 0, 0))).toEqual({
      fiscalYear: 2026,
      quarter: 3,
    });
  });

  it('REQ-05: 31 Oct is Q3 and 1 Nov is Q4', () => {
    expect(verytelQuarterOf(bogota(2026, 9, 31, 23, 59))).toEqual({
      fiscalYear: 2026,
      quarter: 3,
    });
    expect(verytelQuarterOf(bogota(2026, 10, 1, 0, 0))).toEqual({
      fiscalYear: 2026,
      quarter: 4,
    });
  });

  it('REQ-05: 31 Dec stays in Q4 of the same fiscal year', () => {
    expect(verytelQuarterOf(bogota(2026, 11, 31, 23, 59))).toEqual({
      fiscalYear: 2026,
      quarter: 4,
    });
  });

  it('REQ-05: Q4 2026 runs from 1 Nov 2026 through 31 Jan 2027', () => {
    const range = verytelQuarterRange(2026, 4);
    expect(range.start.toISOString()).toBe(
      bogotaDayStart(bogota(2026, 10, 1, 12)).toISOString(),
    );
    expect(range.end.toISOString()).toBe(
      bogotaDayEnd(bogota(2027, 0, 31, 12)).toISOString(),
    );
    expect(formatVerytelQuarterRange(range)).toBe('1 nov 2026 – 31 ene 2027');
  });

  it('REQ-05: each quarter has the Verytel month span', () => {
    expect(formatVerytelQuarterRange(verytelQuarterRange(2026, 1))).toBe(
      '1 feb 2026 – 30 abr 2026',
    );
    expect(formatVerytelQuarterRange(verytelQuarterRange(2026, 2))).toBe(
      '1 may 2026 – 31 jul 2026',
    );
    expect(formatVerytelQuarterRange(verytelQuarterRange(2026, 3))).toBe(
      '1 ago 2026 – 31 oct 2026',
    );
  });

  it('REQ-05: a quarter is finished only after its last Bogota day', () => {
    const q1 = verytelQuarterRange(2026, 1);
    expect(isVerytelQuarterFinished(q1, bogota(2026, 3, 30, 23, 59))).toBe(
      false,
    );
    expect(isVerytelQuarterFinished(q1, bogota(2026, 4, 1, 0, 0))).toBe(true);
  });
});
