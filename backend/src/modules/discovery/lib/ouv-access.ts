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
