/** Roles that may list/view every OUV (not only own comercial_id). */
const READ_ALL_OUV_ROLES = new Set([
  'Admin',
  'SoporteComercial',
  /** Director Mercadeo — follow-up board, read-only (no create/mutate). */
  'DirectorMercadeo',
]);

export function canReadAllOuvs(roleName: string | undefined): boolean {
  return !!roleName && READ_ALL_OUV_ROLES.has(roleName);
}

/** Follow-up viewers: see all OUVs but cannot change states/trays. */
export function isOuvFollowUpViewer(roleName: string | undefined): boolean {
  return roleName === 'DirectorMercadeo';
}
