import { BadRequestException } from '@nestjs/common';
import { CanalOrigen, LeadEstado } from '../models/enums/lead.enums';
import { DEMAND_GENERATION_ERROR_CODES } from '../constants/demand-generation.constants';

const VALID_TRANSITIONS: Record<LeadEstado, LeadEstado[]> = {
  [LeadEstado.Nuevo]: [LeadEstado.TOFU, LeadEstado.Descartado],
  [LeadEstado.TOFU]: [LeadEstado.MOFU, LeadEstado.Descartado],
  [LeadEstado.MOFU]: [LeadEstado.MqlPending, LeadEstado.Descartado],
  [LeadEstado.MqlPending]: [
    LeadEstado.SQL,
    LeadEstado.Reciclaje,
    LeadEstado.Descartado,
  ],
  [LeadEstado.SQL]: [],
  [LeadEstado.Reciclaje]: [LeadEstado.MOFU, LeadEstado.Descartado],
  [LeadEstado.Descartado]: [LeadEstado.MOFU],
};

export function isValidLeadTransition(
  from: LeadEstado,
  to: LeadEstado,
  canalOrigen?: CanalOrigen,
): boolean {
  if (from === to) {
    return true;
  }

  if (
    from === LeadEstado.TOFU &&
    to === LeadEstado.MqlPending &&
    canalOrigen === CanalOrigen.Fabrica
  ) {
    return true;
  }

  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

export function assertValidLeadTransition(
  from: LeadEstado,
  to: LeadEstado,
  canalOrigen?: CanalOrigen,
): void {
  if (isValidLeadTransition(from, to, canalOrigen)) {
    return;
  }

  throw new BadRequestException({
    code: DEMAND_GENERATION_ERROR_CODES.INVALID_TRANSITION,
    message: `Invalid lead state transition from ${from} to ${to}`,
  });
}

export function canRecycleLead(estado: LeadEstado): boolean {
  return estado === LeadEstado.Descartado;
}

export function getAllowedLeadTransitions(from: LeadEstado): LeadEstado[] {
  return VALID_TRANSITIONS[from] ?? [];
}
