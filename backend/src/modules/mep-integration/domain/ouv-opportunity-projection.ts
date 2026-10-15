import { OuvResultado } from '../../discovery/models/enums/ouv.enums';
import { resourceEtag } from './etag';

/** ETag suffix so MEP caching sees OUV-driven status / close-date changes. */
export function opportunityEtagFromOuv(
  crmOpportunityRef: string,
  sourceVersion: string,
  ouv: {
    resultado: OuvResultado;
    expectedCloseDate: string | null;
    updatedAt: Date;
  },
): string {
  const ouvClock = ouv.updatedAt.toISOString();
  const closeDate = ouv.expectedCloseDate ?? 'none';
  return resourceEtag(
    `ouv-${crmOpportunityRef}`,
    `${sourceVersion}-${ouv.resultado}-${closeDate}-${ouvClock}`,
  );
}
