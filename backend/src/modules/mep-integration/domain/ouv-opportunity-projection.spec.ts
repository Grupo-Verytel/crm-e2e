import {
  computeExpectedCloseDateFromOuv,
} from './ouv-opportunity-projection';

describe('ouv-opportunity-projection', () => {
  describe('computeExpectedCloseDateFromOuv', () => {
    it('adds calendar months from created_at', () => {
      expect(
        computeExpectedCloseDateFromOuv(
          new Date('2026-01-15T10:00:00Z'),
          6,
        ),
      ).toBe('2026-07-15');
    });

    it('returns null when plazo is missing', () => {
      expect(
        computeExpectedCloseDateFromOuv(
          new Date('2026-01-15T10:00:00Z'),
          null,
        ),
      ).toBeNull();
    });
  });
});
