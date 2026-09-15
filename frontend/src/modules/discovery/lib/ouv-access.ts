import {
  isDirectorMercadeoRole,
  isGestorMercadeoRole,
  isPreventaRole,
  isSoporteComercialRole,
} from '../../auth/lib/permission-catalog';

/** Roles that may list/view every OUV (not only own comercial_id). */
const READ_ALL_OUV_ROLES = new Set([
  'Admin',
  'SoporteComercial',
]);

export function canReadAllOuvs(roleName: string | undefined): boolean {
  return (
    !!roleName &&
    (READ_ALL_OUV_ROLES.has(roleName) ||
      isSoporteComercialRole(roleName) ||
      isDirectorMercadeoRole(roleName) ||
      isGestorMercadeoRole(roleName) ||
      isPreventaRole(roleName))
  );
}

/** Follow-up viewers: see all OUVs but cannot change states/trays. */
export function isOuvFollowUpViewer(roleName: string | undefined): boolean {
  return (
    isDirectorMercadeoRole(roleName) ||
    isGestorMercadeoRole(roleName) ||
    isSoporteComercialRole(roleName) ||
    isPreventaRole(roleName)
  );
}

/** Soporte owns catalog CRUD (spec-ouv-funnel). Admin too. */
export function canManageOuvCatalogs(roleName: string | undefined): boolean {
  return roleName === 'Admin' || isSoporteComercialRole(roleName);
}

/** Same roles that manage catalogs; the trays perdidas/descartadas are Opportunity, not these pages. */
export function canViewOuvCatalogs(roleName: string | undefined): boolean {
  return canManageOuvCatalogs(roleName);
}
