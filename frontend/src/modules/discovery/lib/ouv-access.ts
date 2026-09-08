import { isRoleName } from '../../../lib/roles';

/**
 * Mutaciones de OUV en curso: solo el comercial dueño.
 * Admin y SoporteComercial son lectura (matriz spec-auth).
 */
export function canMutateOuvEnCurso(
  comercialId: string,
  actorUserId: string,
  _roleName?: string,
): boolean {
  return comercialId === actorUserId;
}

/**
 * Only EjecutivoComercial is scoped to own `comercial_id`.
 * Any other role that can open the board lists every OUV.
 */
export function canReadAllOuvs(roleName: string | undefined): boolean {
  return !!roleName && !isRoleName(roleName, 'EjecutivoComercial');
}
