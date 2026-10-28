import {
  verytelFiscalPeriod,
  type VerytelQuarter,
} from '../../../common/time/verytel-quarter';

/**
 * Marketing fiscal calendar for a selected year (America/Bogota dates).
 *
 * Q1: 1 Feb – 30 Apr
 * Q2: 1 May – 31 Jul
 * Q3: 1 Aug – 31 Oct
 * Q4: 1 Nov – 31 Jan of the following year
 *
 * A year without quarter is the full fiscal year: 1 Feb → 31 Jan next year.
 * Returned `end` is exclusive (next day at Bogotá midnight).
 */

function asQuarter(quarter?: number | null): VerytelQuarter | null {
  if (quarter === 1 || quarter === 2 || quarter === 3 || quarter === 4) {
    return quarter;
  }
  return null;
}

export function marketingFiscalRange(
  year: number,
  quarter?: number | null,
): { start: Date; end: Date } {
  return verytelFiscalPeriod(year, asQuarter(quarter));
}
