import { OuvResultado } from '../../discovery/models/enums/ouv.enums';
import { resourceEtag } from './etag';
import { toDateOnly } from './rfc3339';

/**
 * Estimated close = OUV creation date + execution term in calendar months.
 * Returns `null` when the term is missing or not a positive integer.
 */
export function computeExpectedCloseDateFromOuv(
  createdAt: Date | string,
  plazoEjecucionMeses: number | null | undefined,
): string | null {
  if (
    plazoEjecucionMeses === null ||
    plazoEjecucionMeses === undefined ||
    !Number.isInteger(plazoEjecucionMeses) ||
    plazoEjecucionMeses < 1
  ) {
    return null;
  }

  const start =
    createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const estimated = new Date(start.getTime());
  estimated.setUTCMonth(estimated.getUTCMonth() + plazoEjecucionMeses);

  return toDateOnly(estimated);
}

/** ETag suffix so MEP caching sees OUV-driven status / close-date changes. */
export function opportunityEtagFromOuv(
  crmOpportunityRef: string,
  sourceVersion: string,
  ouv: {
    resultado: OuvResultado;
    plazoEjecucionMeses: number | null;
    updatedAt: Date;
  },
): string {
  const ouvClock = ouv.updatedAt.toISOString();
  const plazo = ouv.plazoEjecucionMeses ?? 'none';
  return resourceEtag(
    `ouv-${crmOpportunityRef}`,
    `${sourceVersion}-${ouv.resultado}-${plazo}-${ouvClock}`,
  );
}
