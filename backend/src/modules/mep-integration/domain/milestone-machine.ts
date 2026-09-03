import { BusinessMilestone, ResponseStatus } from './enums';

/**
 * Máquina de los 4 hitos comerciales — §7.1, INV-16.
 *
 * Orden no regresivo. Se admite repetir el mismo hito en una nueva
 * `response_version`; se prohíbe retroceder. Una vez alcanzado
 * `INTERACTION_COMPLETED`, publicar un hito distinto es 422.
 */

const MILESTONE_ORDER: BusinessMilestone[] = [
  BusinessMilestone.INTERACTION_RECEIVED,
  BusinessMilestone.ENGINEER_ASSIGNED,
  BusinessMilestone.ROUTE_CAPACITY_REGISTERED,
  BusinessMilestone.INTERACTION_COMPLETED,
];

export function milestoneRank(milestone: BusinessMilestone): number {
  const rank = MILESTONE_ORDER.indexOf(milestone);
  if (rank < 0) {
    throw new Error(`Hito desconocido: ${String(milestone)}`);
  }
  return rank;
}

/** ¿`candidate` retrocede respecto de `current`? (INV-16) */
export function isRegression(
  current: BusinessMilestone,
  candidate: BusinessMilestone,
): boolean {
  return milestoneRank(candidate) < milestoneRank(current);
}

/** `response_status` exigido por cada hito (§7.1). */
export function requiredResponseStatus(
  milestone: BusinessMilestone,
): ResponseStatus | null {
  switch (milestone) {
    case BusinessMilestone.INTERACTION_RECEIVED:
      return ResponseStatus.RECEIVED;
    case BusinessMilestone.ENGINEER_ASSIGNED:
      return ResponseStatus.IN_PROGRESS;
    case BusinessMilestone.INTERACTION_COMPLETED:
      return ResponseStatus.COMPLETED;
    default:
      // ROUTE_CAPACITY_REGISTERED no fija `response_status` en §7.1.
      return null;
  }
}

/** ¿El hito exige `assignment` (propio o heredado de un hito anterior)? */
export function requiresAssignment(milestone: BusinessMilestone): boolean {
  return (
    milestoneRank(milestone) >=
    milestoneRank(BusinessMilestone.ENGINEER_ASSIGNED)
  );
}

/** ¿El hito exige `route_capacity`, `eta_date` y su URL de registro? */
export function requiresRouteCapacity(milestone: BusinessMilestone): boolean {
  return (
    milestoneRank(milestone) >=
    milestoneRank(BusinessMilestone.ROUTE_CAPACITY_REGISTERED)
  );
}

export { MILESTONE_ORDER };
