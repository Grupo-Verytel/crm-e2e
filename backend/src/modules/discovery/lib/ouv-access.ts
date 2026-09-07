import { ForbiddenException } from '@nestjs/common';

/**
 * Mutaciones de OUV en curso: solo el comercial dueño.
 * Admin y SoporteComercial son lectura (matriz spec-auth §3.1: `opportunities (OUV)`
 * da `R` a Admin y `CRUX` al ejecutivo). Por eso el rol no abre excepciones acá:
 * ser Admin no habilita a mover la OUV de otro.
 */
export function canMutateOuvEnCurso(
  comercialId: string,
  actorUserId: string,
): boolean {
  return comercialId === actorUserId;
}

/** Igual que `canMutateOuvEnCurso`, pero cortando el flujo con 403. */
export function assertCanMutateOuvEnCurso(
  comercialId: string,
  actorUserId: string,
): void {
  if (!canMutateOuvEnCurso(comercialId, actorUserId)) {
    throw new ForbiddenException(
      'Only the owning Ejecutivo Comercial can perform this action',
    );
  }
}
