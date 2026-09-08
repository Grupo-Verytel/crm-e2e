/**
 * Mutaciones de OUV en curso: solo el comercial dueño.
 * Admin y SoporteComercial son lectura (matriz spec-auth).
 */

function compactRoleName(roleName: string): string {
  return roleName.replace(/[\s_-]/g, '').toLowerCase();
}

/**
 * Only pipeline owners are scoped to `comercial_id`.
 * Any other role that already passed CASL `read Opportunity` sees every OUV
 * (Gerente Comercial, Soporte, Preventa, custom follow-up roles, etc.).
 */
const OWN_PIPELINE_ROLES = new Set(['ejecutivocomercial']);

export function canReadAllOuvs(roleName: string | undefined): boolean {
  return !!roleName && !OWN_PIPELINE_ROLES.has(compactRoleName(roleName));
}

export function canMutateOuvEnCurso(
  comercialId: string,
  actorUserId: string,
  _roleName?: string,
): boolean {
  return comercialId === actorUserId;
}
