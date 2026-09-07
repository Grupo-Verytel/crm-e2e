import { ForbiddenException } from '@nestjs/common';
import type { Ouv } from '../models/ouv.model';

/** Roles that may list/view every OUV (not only own comercial_id). */
const READ_ALL_OUV_ROLES = new Set([
  'Admin',
  'SoporteComercial',
  /** Director Mercadeo — follow-up board, read-only (no mutate). */
  'DirectorMercadeo',
]);

export function canReadAllOuvs(roleName: string): boolean {
  return READ_ALL_OUV_ROLES.has(roleName);
}

/** Owner Ejecutivo, or Admin acting in support/dev. */
export function assertCanMutateOuvAsOwner(
  ouv: Ouv,
  actorUserId: string,
  actorRoleName: string,
): void {
  if (actorRoleName === 'Admin') {
    return;
  }
  if (ouv.comercialId !== actorUserId) {
    throw new ForbiddenException(
      'Only the owning Ejecutivo Comercial can perform this action',
    );
  }
}
