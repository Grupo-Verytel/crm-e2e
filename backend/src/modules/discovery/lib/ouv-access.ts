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

/**
 * Lectura de una OUV: el ejecutivo ve las suyas; SoporteComercial y Admin ven
 * todas. Es la misma regla que aplica el detalle de la OUV, extraída aquí para
 * que los módulos que cuelgan de una OUV —cierre de oferta, kickoff— no
 * inventen una propia más laxa.
 */
export function canReadOuv(
  comercialId: string,
  actorUserId: string,
  roleName: string,
): boolean {
  if (roleName === 'SoporteComercial' || roleName === 'Admin') return true;
  return comercialId === actorUserId;
}

/** Igual que `canReadOuv`, pero cortando el flujo con 403. */
export function assertCanReadOuv(
  comercialId: string,
  actorUserId: string,
  roleName: string,
): void {
  if (!canReadOuv(comercialId, actorUserId, roleName)) {
    throw new ForbiddenException('Not allowed to view this OUV');
  }
}

/**
 * Roles cuyo alcance es su propia cartera. Para el resto, el permiso CASL ya
 * expresa la intención: PMO, Preventa, Pricing y DirectorMercadeo tienen
 * lectura sobre los expedientes justamente para supervisar los de todos.
 */
const ROLES_ACOTADOS_A_SU_CARTERA = new Set(['EjecutivoComercial']);

/**
 * Acceso a lo que cuelga de una OUV (expediente de cierre, kickoff).
 *
 * A diferencia de `canReadOuv`, aquí el rol ya pasó por CASL: lo único que
 * falta es impedir que un ejecutivo comercial alcance la oportunidad de otro.
 */
export function canReachOuvChild(
  comercialId: string,
  actorUserId: string,
  roleName: string,
): boolean {
  if (!ROLES_ACOTADOS_A_SU_CARTERA.has(roleName)) return true;
  return comercialId === actorUserId;
}

/** Igual que `canReachOuvChild`, pero cortando el flujo con 403. */
export function assertCanReachOuvChild(
  comercialId: string,
  actorUserId: string,
  roleName: string,
): void {
  if (!canReachOuvChild(comercialId, actorUserId, roleName)) {
    throw new ForbiddenException('Not allowed to access this OUV');
  }
}
