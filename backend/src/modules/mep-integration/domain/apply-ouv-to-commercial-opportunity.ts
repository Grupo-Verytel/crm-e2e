import type { Ouv } from '../../discovery/models/ouv.model';
import { OuvResultado } from '../../discovery/models/enums/ouv.enums';
import type { CommercialOpportunity } from '../models';
import { opportunityEtagFromOuv } from './ouv-opportunity-projection';

export interface OuvOpportunityProjectionInput {
  resultado: OuvResultado;
  expectedCloseDate: string | null;
  updatedAt: Date;
  comercialId: string;
  commercialOwnerDisplayName: string | null;
}

export function ouvToOpportunityProjection(
  ouv: Ouv,
): OuvOpportunityProjectionInput {
  const name = ouv.comercial?.fullName?.trim();
  return {
    resultado: ouv.resultado,
    expectedCloseDate: ouv.expectedCloseDate ?? null,
    updatedAt: ouv.updatedAt,
    comercialId: ouv.comercialId,
    commercialOwnerDisplayName: name ? name : null,
  };
}

/** Overlays MEP contract fields from the authoritative OUV row. */
export function applyOuvFieldsToCommercialOpportunity(
  opportunity: CommercialOpportunity,
  ouv: OuvOpportunityProjectionInput,
): void {
  opportunity.status = ouv.resultado;
  opportunity.expectedCloseDate = ouv.expectedCloseDate ?? null;
  opportunity.commercialOwnerRef = ouv.comercialId;
  opportunity.commercialOwnerName = ouv.commercialOwnerDisplayName;
  opportunity.etag = opportunityEtagFromOuv(
    opportunity.crmOpportunityRef,
    opportunity.sourceVersion,
    ouv,
  );
}
