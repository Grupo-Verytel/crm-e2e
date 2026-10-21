import { GERENTE_COMERCIAL_ROLE_NAME } from '../../auth/constants/commercial-roles';
import { EntityType } from '../enums/entity-type.enum';
import type {
  GuardResult,
  WorkflowGuardContext,
} from '../types/workflow.types';
import { findWorkflowRule } from '../workflow.rules';
import { guardEjecutivoOGerenteAsignado } from './guard-ejecutivo-o-gerente-asignado';

function ctx(
  overrides: Partial<WorkflowGuardContext> = {},
): WorkflowGuardContext {
  return {
    entityType: EntityType.OUV,
    entityId: 'ouv-1',
    entityLabel: 'OUV-0001',
    actorUserId: 'user-1',
    estadoAnterior: 'UNIVERSO',
    estadoNuevo: 'ENCIMA_FUNNEL',
    payload: { comercial_id: 'user-1' },
    entity: { estado: 'UNIVERSO' },
    usersService: {
      isActiveWithRole: (userId: string, role: string) =>
        Promise.resolve(userId === 'ejec-1' && role === 'EjecutivoComercial'),
    } as WorkflowGuardContext['usersService'],
    ...overrides,
  };
}

function users(active: Record<string, string>) {
  return {
    isActiveWithRole: (userId: string, role: string) =>
      Promise.resolve(active[userId] === role),
  } as WorkflowGuardContext['usersService'];
}

describe('guardEjecutivoOGerenteAsignado', () => {
  const guard = guardEjecutivoOGerenteAsignado('comercial_id');

  it('REQ-10: an active EjecutivoComercial still passes', async () => {
    const result = await guard(
      ctx({
        actorUserId: 'ejec-1',
        payload: { comercial_id: 'someone-else' },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('REQ-10: Gerente Comercial passes only as the assigned commercial', async () => {
    const gerente = users({ 'gerente-1': GERENTE_COMERCIAL_ROLE_NAME });
    const own = await guard(
      ctx({
        actorUserId: 'gerente-1',
        payload: { comercial_id: 'gerente-1' },
        usersService: gerente,
      }),
    );
    const foreign = await guard(
      ctx({
        actorUserId: 'gerente-1',
        payload: { comercial_id: 'ejec-1' },
        usersService: gerente,
      }),
    );

    expect(own.ok).toBe(true);
    expect(foreign.ok).toBe(false);
  });

  it('rejects a role that is neither Ejecutivo nor Gerente', async () => {
    const result = await guard(
      ctx({
        actorUserId: 'soporte-1',
        usersService: users({ 'soporte-1': 'SoporteComercial' }),
      }),
    );
    expect(result.ok).toBe(false);
  });
});

const GERENTE_ID = 'gerente-1';
const OTHER_COMMERCIAL_ID = 'ejec-9';

const LIMITED_EVENTS = [
  {
    eventType: 'ouv.avance_zona',
    entityType: EntityType.OUV,
    estado: 'UNIVERSO',
  },
  {
    eventType: 'ouv.retroceso_zona',
    entityType: EntityType.OUV,
    estado: 'EN_FUNNEL',
  },
  {
    eventType: 'sql.convertido_ouv',
    entityType: EntityType.SQL,
    estado: 'Asignado',
  },
  {
    eventType: 'sql.cita_reagendada',
    entityType: EntityType.SQL,
    estado: 'Asignado',
  },
  {
    eventType: 'sql.descartado',
    entityType: EntityType.SQL,
    estado: 'Asignado',
  },
] as const;

function limitContext(
  event: (typeof LIMITED_EVENTS)[number],
  comercialId: string,
  activeGerente: boolean,
): WorkflowGuardContext {
  return {
    entityType: event.entityType,
    entityId: 'entity-1',
    entityLabel: 'ENT-0001',
    actorUserId: GERENTE_ID,
    estadoAnterior: event.estado,
    estadoNuevo: 'ENCIMA_FUNNEL',
    payload: {
      comercial_id: comercialId,
      comercial_asignado_id: comercialId,
      zona_nueva: 'ENCIMA_FUNNEL',
      presupuesto_confirmado: true,
      influencias_verde_count: 2,
    },
    entity: { estado: event.estado },
    usersService: {
      isActiveWithRole: (userId: string, role: string) =>
        Promise.resolve(
          activeGerente &&
            userId === GERENTE_ID &&
            role === GERENTE_COMERCIAL_ROLE_NAME,
        ),
    } as WorkflowGuardContext['usersService'],
  };
}

async function assignmentGuardRejection(
  eventType: string,
  context: WorkflowGuardContext,
): Promise<GuardResult> {
  const rule = findWorkflowRule(eventType);
  if (!rule) {
    throw new Error(`Missing workflow rule ${eventType}`);
  }

  for (const guard of rule.guards) {
    const result = await guard(context);
    if (!result.ok && result.guard === 'guardEjecutivoOGerenteAsignado') {
      return result;
    }
  }

  return { ok: true };
}

describe('C1 Gerente Comercial cannot act on another commercial', () => {
  it.each(LIMITED_EVENTS)(
    '$eventType: active Gerente Comercial on another commercial is rejected',
    async (event) => {
      const result = await assignmentGuardRejection(
        event.eventType,
        limitContext(event, OTHER_COMMERCIAL_ID, true),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.guard).toBe('guardEjecutivoOGerenteAsignado');
      }
    },
  );

  it('inactive Gerente Comercial is rejected even when assigned', async () => {
    for (const event of LIMITED_EVENTS) {
      const result = await assignmentGuardRejection(
        event.eventType,
        limitContext(event, GERENTE_ID, false),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.guard).toBe('guardEjecutivoOGerenteAsignado');
      }
    }
  });
});
