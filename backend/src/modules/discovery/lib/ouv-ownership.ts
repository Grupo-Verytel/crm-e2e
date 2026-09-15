import { ForbiddenException } from '@nestjs/common';
import type { Ouv } from '../models/ouv.model';

function normalizeRoleKey(name: string): string {
  return name.replace(/[\s_-]/g, '').toLowerCase();
}

const READ_ALL_OUV_ROLE_KEYS = new Set([
  'admin',
  'soportecomercial',
  'directormercadeo',
  'gestormercadeo',
  'preventa',
  'ingenieropreventa',
]);

/** Roles that may list/view every OUV (not only own comercial_id). */
export function canReadAllOuvs(roleName: string): boolean {
  return READ_ALL_OUV_ROLE_KEYS.has(normalizeRoleKey(roleName));
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
