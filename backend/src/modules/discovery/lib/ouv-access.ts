/**
 * Mutaciones de OUV en curso: solo el comercial dueño.
 * Admin y SoporteComercial son lectura (matriz spec-auth).
 */

function compactRoleName(roleName: string): string {
  return roleName.replace(/[\s_-]/g, '').toLowerCase();
}

/** Roles that may list/view every OUV (not only own comercial_id). */
const READ_ALL_OUV_ROLES = new Set([
  'admin',
  'soportecomercial',
  'directormercadeo',
  'gestormercadeo',
  'preventa',
  'pricing',
]);

export function canReadAllOuvs(roleName: string | undefined): boolean {
  return !!roleName && READ_ALL_OUV_ROLES.has(compactRoleName(roleName));
}

export function canMutateOuvEnCurso(
  comercialId: string,
  actorUserId: string,
  _roleName?: string,
): boolean {
  return comercialId === actorUserId;
}
