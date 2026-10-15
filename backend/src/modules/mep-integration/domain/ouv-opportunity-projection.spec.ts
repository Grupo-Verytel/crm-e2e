import { OuvResultado } from '../../discovery/models/enums/ouv.enums';
import { opportunityEtagFromOuv } from './ouv-opportunity-projection';

describe('ouv-opportunity-projection', () => {
  const updatedAt = new Date('2026-09-01T00:00:00.000Z');

  it('includes ouvs.expected_close_date in the etag', () => {
    const withDate = opportunityEtagFromOuv('OUV-0001', '4', {
      resultado: OuvResultado.EnCurso,
      expectedCloseDate: '2026-10-25',
      updatedAt,
    });
    const withoutDate = opportunityEtagFromOuv('OUV-0001', '4', {
      resultado: OuvResultado.EnCurso,
      expectedCloseDate: null,
      updatedAt,
    });

    expect(withDate).not.toBe(withoutDate);
  });
});
