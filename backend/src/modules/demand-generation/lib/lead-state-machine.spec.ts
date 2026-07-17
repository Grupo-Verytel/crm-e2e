import {
  assertValidLeadTransition,
  getAllowedLeadTransitions,
  isValidLeadTransition,
} from './lead-state-machine';
import { CanalOrigen, LeadEstado } from '../models/enums/lead.enums';

describe('Lead state machine (spec §4)', () => {
  it('DG-03: allows Nuevo → TOFU', () => {
    expect(isValidLeadTransition(LeadEstado.Nuevo, LeadEstado.TOFU)).toBe(true);
  });

  it('allows the happy-path transitions TOFU → MOFU → MQL_PENDING → SQL', () => {
    expect(isValidLeadTransition(LeadEstado.TOFU, LeadEstado.MOFU)).toBe(true);
    expect(isValidLeadTransition(LeadEstado.MOFU, LeadEstado.MqlPending)).toBe(
      true,
    );
    expect(isValidLeadTransition(LeadEstado.MqlPending, LeadEstado.SQL)).toBe(
      true,
    );
  });

  it('EARS-19: allows the FABRICA graph transition TOFU → MQL_PENDING', () => {
    expect(
      isValidLeadTransition(
        LeadEstado.TOFU,
        LeadEstado.MqlPending,
        CanalOrigen.Fabrica,
      ),
    ).toBe(true);
    expect(
      isValidLeadTransition(
        LeadEstado.TOFU,
        LeadEstado.MqlPending,
        CanalOrigen.CampanaDigital,
      ),
    ).toBe(false);
  });

  it('allows MQL_PENDING → Reciclaje (Director rejects) and Descartado → MOFU (recycle)', () => {
    expect(
      isValidLeadTransition(LeadEstado.MqlPending, LeadEstado.Reciclaje),
    ).toBe(true);
    expect(isValidLeadTransition(LeadEstado.Descartado, LeadEstado.MOFU)).toBe(
      true,
    );
  });

  it('rejects prohibited transitions', () => {
    expect(isValidLeadTransition(LeadEstado.SQL, LeadEstado.Nuevo)).toBe(false);
    expect(isValidLeadTransition(LeadEstado.Nuevo, LeadEstado.SQL)).toBe(false);

    expect(() =>
      assertValidLeadTransition(LeadEstado.SQL, LeadEstado.Nuevo),
    ).toThrow('Invalid lead state transition');
  });

  it('SQL is terminal within this module', () => {
    expect(getAllowedLeadTransitions(LeadEstado.SQL)).toHaveLength(0);
  });
});
