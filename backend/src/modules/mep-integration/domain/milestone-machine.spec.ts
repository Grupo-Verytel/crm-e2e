import { BusinessMilestone, ResponseStatus } from './enums';
import {
  isRegression,
  milestoneRank,
  requiredResponseStatus,
  requiresAssignment,
  requiresRouteCapacity,
} from './milestone-machine';

const {
  INTERACTION_RECEIVED,
  ENGINEER_ASSIGNED,
  ROUTE_CAPACITY_REGISTERED,
  INTERACTION_COMPLETED,
} = BusinessMilestone;

describe('máquina de hitos comerciales — §7.1', () => {
  it('INV-16: el orden de los 4 hitos es estricto', () => {
    expect(milestoneRank(INTERACTION_RECEIVED)).toBe(0);
    expect(milestoneRank(ENGINEER_ASSIGNED)).toBe(1);
    expect(milestoneRank(ROUTE_CAPACITY_REGISTERED)).toBe(2);
    expect(milestoneRank(INTERACTION_COMPLETED)).toBe(3);
  });

  it('INV-16: repetir el mismo hito en una nueva versión no es regresión', () => {
    expect(
      isRegression(ROUTE_CAPACITY_REGISTERED, ROUTE_CAPACITY_REGISTERED),
    ).toBe(false);
  });

  it('INV-16: avanzar al siguiente hito no es regresión', () => {
    expect(isRegression(ENGINEER_ASSIGNED, ROUTE_CAPACITY_REGISTERED)).toBe(
      false,
    );
  });

  it('TS-MIL-07 / INV-16: retroceder de ROUTE_CAPACITY_REGISTERED a ENGINEER_ASSIGNED es regresión', () => {
    expect(isRegression(ROUTE_CAPACITY_REGISTERED, ENGINEER_ASSIGNED)).toBe(
      true,
    );
  });

  it('INV-16: saltar hitos hacia adelante está permitido', () => {
    expect(isRegression(INTERACTION_RECEIVED, INTERACTION_COMPLETED)).toBe(
      false,
    );
  });

  it('§7.1: cada hito exige su response_status', () => {
    expect(requiredResponseStatus(INTERACTION_RECEIVED)).toBe(
      ResponseStatus.RECEIVED,
    );
    expect(requiredResponseStatus(ENGINEER_ASSIGNED)).toBe(
      ResponseStatus.IN_PROGRESS,
    );
    expect(requiredResponseStatus(INTERACTION_COMPLETED)).toBe(
      ResponseStatus.COMPLETED,
    );
    // §7.1 no fija `response_status` para ROUTE_CAPACITY_REGISTERED.
    expect(requiredResponseStatus(ROUTE_CAPACITY_REGISTERED)).toBeNull();
  });

  it('§7.1: lo exigido por un hito permanece exigido en los posteriores', () => {
    expect(requiresAssignment(INTERACTION_RECEIVED)).toBe(false);
    expect(requiresAssignment(ENGINEER_ASSIGNED)).toBe(true);
    expect(requiresAssignment(ROUTE_CAPACITY_REGISTERED)).toBe(true);
    expect(requiresAssignment(INTERACTION_COMPLETED)).toBe(true);

    expect(requiresRouteCapacity(ENGINEER_ASSIGNED)).toBe(false);
    expect(requiresRouteCapacity(ROUTE_CAPACITY_REGISTERED)).toBe(true);
    expect(requiresRouteCapacity(INTERACTION_COMPLETED)).toBe(true);
  });
});
