import { ForbiddenException } from '@nestjs/common';
import type { Ouv } from '../models/ouv.model';

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
