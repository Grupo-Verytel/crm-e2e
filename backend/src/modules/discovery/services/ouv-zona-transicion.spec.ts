import { BadRequestException } from '@nestjs/common';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { findWorkflowRule } from '../../workflow-engine/workflow.rules';
import type { WorkflowGuardContext } from '../../workflow-engine/types/workflow.types';
import { OuvResultado, OuvZona } from '../models/enums/ouv.enums';
import { OuvsService } from './ouvs.service';

const transaction = { LOCK: { UPDATE: 'UPDATE' } };

function harness(row: {
  zonaActual: OuvZona;
  presupuestoConfirmado?: boolean;
  presupuestoMonto?: string | null;
  tieneGap?: boolean;
  criteriosFaltantes?: string[] | null;
}) {
  const ouv = {
    ouvId: 'ouv-1',
    consecutivo: 'OUV-0001',
    comercialId: 'user-1',
    resultado: OuvResultado.EnCurso,
    titulo: 'Titulo',
    tieneGap: row.tieneGap ?? true,
    criteriosFaltantes:
      row.criteriosFaltantes === undefined
        ? ['presupuesto_confirmado']
        : row.criteriosFaltantes,
    zonaActual: row.zonaActual,
    presupuestoConfirmado: row.presupuestoConfirmado ?? false,
    presupuestoMonto:
      row.presupuestoMonto === undefined ? null : row.presupuestoMonto,
    update: jest.fn(async (patch: Record<string, unknown>) => {
      Object.assign(ouv, patch);
    }),
  };
  const sequelize = {
    transaction: async (fn: (t: typeof transaction) => Promise<unknown>) =>
      fn(transaction),
  };
  const workflow = { transition: jest.fn() };
  const criterios = { evaluate: jest.fn() };
  const checklist = { seedChecklistParaZona: jest.fn() };
  const influencias = { countGreenTypes: jest.fn(async () => 0) };
  const service = new OuvsService(
    sequelize as never,
    { findByPk: jest.fn(async () => ouv) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    influencias as never,
    checklist as never,
    {} as never,
    criterios as never,
    workflow as never,
    {} as never,
  );
  return { service, ouv, workflow, criterios, checklist };
}

describe('avanzarZona payload through ouv.avance_zona guards', () => {
  it('AJ1: UNIVERSO to ENCIMA_FUNNEL with 0 verdes and no presupuesto passes every guard', async () => {
    const { service, workflow, checklist } = harness({
      zonaActual: OuvZona.Universo,
      presupuestoConfirmado: false,
      presupuestoMonto: null,
    });

    await service.avanzarZona('ouv-1', 'user-1', 'EjecutivoComercial');

    expect(checklist.seedChecklistParaZona).toHaveBeenCalledWith(
      'ouv-1',
      OuvZona.EncimaFunnel,
      transaction,
    );
    expect(workflow.transition).toHaveBeenCalledTimes(1);
    const [entityType, entityId, eventType, context] =
      workflow.transition.mock.calls[0];
    expect(entityType).toBe(EntityType.OUV);
    expect(entityId).toBe('ouv-1');
    expect(eventType).toBe('ouv.avance_zona');
    expect(context.payload.zona_nueva).toBe(OuvZona.EncimaFunnel);
    expect(context.payload.presupuesto_confirmado).toBe(false);
    expect(context.payload.presupuesto_monto).toBeNull();
    expect(context.payload.influencias_verde_count).toBe(0);

    const rule = findWorkflowRule('ouv.avance_zona');
    expect(rule).toBeDefined();
    const ctx: WorkflowGuardContext = {
      entityType: EntityType.OUV,
      entityId: 'ouv-1',
      entityLabel: context.entityLabel,
      actorUserId: context.actorUserId,
      estadoAnterior: context.estadoAnterior,
      estadoNuevo: context.estadoNuevo,
      payload: context.payload,
      entity: context.entity,
      usersService: {
        isActiveWithRole: async (userId: string, role: string) =>
          userId === 'user-1' && role === 'EjecutivoComercial',
      } as WorkflowGuardContext['usersService'],
    };
    for (const guard of rule!.guards) {
      const result = await guard(ctx);
      expect(result.ok).toBe(true);
    }
  });
});

describe('retrocederZona keeps the current behavior', () => {
  it('R1: ENCIMA_FUNNEL from EN_FUNNEL does not apply the budget gate', async () => {
    const { service, ouv, workflow } = harness({
      zonaActual: OuvZona.EnFunnel,
      presupuestoConfirmado: false,
      presupuestoMonto: null,
    });
    await service.retrocederZona(
      'ouv-1',
      'El cliente pidió volver',
      'user-1',
      'EjecutivoComercial',
    );
    expect(ouv.zonaActual).toBe(OuvZona.EncimaFunnel);
    expect(workflow.transition).toHaveBeenCalledWith(
      EntityType.OUV,
      'ouv-1',
      'ouv.retroceso_zona',
      expect.objectContaining({
        payload: expect.objectContaining({
          zona_nueva: OuvZona.EncimaFunnel,
          motivo: 'El cliente pidió volver',
        }),
      }),
      transaction,
    );
  });

  it('R2: EN_FUNNEL from MAYOR_PROBABILIDAD does not apply the influence filter', async () => {
    const { service, ouv } = harness({
      zonaActual: OuvZona.MayorProbabilidad,
      presupuestoConfirmado: false,
      presupuestoMonto: null,
    });
    await service.retrocederZona(
      'ouv-1',
      'Falta una influencia',
      'user-1',
      'EjecutivoComercial',
    );
    expect(ouv.zonaActual).toBe(OuvZona.EnFunnel);
  });

  it('R3: rejects a retreat from UNIVERSO', async () => {
    const { service } = harness({ zonaActual: OuvZona.Universo });
    await expect(
      service.retrocederZona('ouv-1', 'motivo', 'user-1', 'EjecutivoComercial'),
    ).rejects.toThrow(
      'Cannot retroceder from UNIVERSO — use Descartada instead',
    );
  });

  it('R4: rejects an empty motivo', async () => {
    const { service } = harness({ zonaActual: OuvZona.EnFunnel });
    await expect(
      service.retrocederZona('ouv-1', '   ', 'user-1', 'EjecutivoComercial'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('an OUV that stays in zone is not recalculated', () => {
  it('R5: editing metadata does not move the zone or rewrite the stored gap', async () => {
    const { service, ouv, criterios } = harness({
      zonaActual: OuvZona.EnFunnel,
      presupuestoConfirmado: false,
      presupuestoMonto: null,
      tieneGap: false,
      criteriosFaltantes: null,
    });
    await service.actualizarMetadatos(
      'ouv-1',
      { titulo: 'Titulo nuevo' },
      'user-1',
      'EjecutivoComercial',
    );
    expect(ouv.zonaActual).toBe(OuvZona.EnFunnel);
    expect(ouv.tieneGap).toBe(false);
    expect(ouv.criteriosFaltantes).toBeNull();
    expect(criterios.evaluate).not.toHaveBeenCalled();
    expect(ouv.update).toHaveBeenCalledWith(
      { titulo: 'Titulo nuevo' },
      { transaction },
    );
  });
});
