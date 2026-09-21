/**
 * Immutable lead-origin snapshot copied onto the OUV at Vía 1 create.
 * Direct OUVs and pre-v1.5 rows stay null (no backfill).
 */
export function snapshotLeadSource(lead: {
  origen?: string | null;
  canal_origen?: string | null;
}): { origin: string | null; sourceChannel: string | null } {
  return {
    origin: lead.origen?.trim() || null,
    sourceChannel: lead.canal_origen?.trim() || null,
  };
}
