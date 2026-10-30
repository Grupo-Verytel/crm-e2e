import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CommercialReportsService } from './commercial-reports.service';

const ANA = '039f487b-c346-443b-a69d-d0c2e9b0aba5';
const LUIS = '11111111-1111-4111-8111-111111111111';

function actor(roleName: string, userId = ANA): AuthenticatedUser {
  return { userId, roleName, permissions: [] };
}

function ouv(partial: {
  ouvId: string;
  comercialId?: string;
  resultado?: string;
  createdAt?: Date;
  expectedCloseDate?: string | null;
}) {
  return {
    ouvId: partial.ouvId,
    consecutivo: partial.ouvId,
    titulo: 'Oportunidad',
    comercialId: partial.comercialId ?? ANA,
    segmento: 'Industria',
    zonaActual: 'UNIVERSO',
    resultado: partial.resultado ?? 'EnCurso',
    presupuestoMonto: '100',
    montoFinal: null,
    montoEstimadoPerdido: null,
    fechaCierre: null,
    createdAt: partial.createdAt ?? new Date('2026-10-22T15:00:00.000Z'),
    updatedAt: new Date('2026-10-22T15:00:00.000Z'),
    origin: null,
    origenVia: 'directa',
    motivoSnapshot: null,
    empresaNombre: 'Acme',
    presupuestoMoneda: 'COP',
    monedaFinal: null,
    expectedCloseDate: partial.expectedCloseDate ?? null,
    comercial: { fullName: 'Ana' },
  };
}

function createService(rows = [ouv({ ouvId: 'one' })]) {
  const findAll = jest.fn().mockResolvedValue(rows);
  const userFindAll = jest
    .fn()
    .mockResolvedValue([{ userId: ANA, fullName: 'Ana Ruiz' }]);
  const listForEntities = jest.fn().mockResolvedValue([]);
  const listFieldUpdates = jest.fn().mockResolvedValue([]);
  const service = new CommercialReportsService(
    { findAll } as never,
    { findAll: userFindAll } as never,
    { listForEntities } as never,
    { listFieldUpdates } as never,
  );
  return { service, findAll, listForEntities, listFieldUpdates };
}

function whereOf(call: unknown[]): Record<string, unknown> {
  return (call[0] as { where: Record<string, unknown> }).where;
}

const NOW = new Date('2026-10-28T18:00:00.000Z');

describe('CommercialReportsService scope', () => {
  it('limits EjecutivoComercial to their own OUVs on every report', async () => {
    const { service, findAll } = createService();
    const ejecutivo = actor('EjecutivoComercial', ANA);

    await service.getCommittee(
      { year: 2026, comercial_id: LUIS },
      ejecutivo,
      NOW,
    );
    await service.getPipelineHealth({ comercial_id: LUIS }, ejecutivo, NOW);
    await service.getDetails(
      {
        report: 'committee',
        kind: 'm003_new',
        comercial_id: LUIS,
        page: 1,
        limit: 20,
      },
      ejecutivo,
      NOW,
    );

    expect(findAll).toHaveBeenCalledTimes(3);
    for (const call of findAll.mock.calls as unknown[][]) {
      expect(whereOf(call).comercialId).toBe(ANA);
    }
  });

  it('lets Gerente Comercial read every OUV and still honor a commercial filter', async () => {
    const { service, findAll } = createService();

    await service.getCommittee(
      { year: 2026, quarter: 3 },
      actor('Gerente Comercial'),
      NOW,
    );
    await service.getPipelineHealth({}, actor('Gerente Comercial'), NOW);
    await service.getDetails(
      {
        report: 'pipeline-health',
        kind: 'm023_aged',
        comercial_id: LUIS,
        page: 1,
        limit: 20,
      },
      actor('Gerente Comercial'),
      NOW,
    );

    const calls = findAll.mock.calls as unknown[][];
    expect(whereOf(calls[0]).comercialId).toBeUndefined();
    expect(whereOf(calls[1]).comercialId).toBeUndefined();
    expect(whereOf(calls[2]).comercialId).toBe(LUIS);
  });

  it('asks audit_log only for presupuesto_monto and monto_final', async () => {
    const { service, listFieldUpdates } = createService();
    await service.getCommittee({ year: 2026 }, actor('Admin'), NOW);
    expect(listFieldUpdates).toHaveBeenCalledWith(
      'ouvs',
      ['one'],
      ['presupuesto_monto', 'monto_final'],
    );
  });

  it('returns JSON null amounts as null', async () => {
    const rows = [ouv({ ouvId: 'one' })];
    const findAll = jest.fn().mockResolvedValue(rows);
    const listForEntities = jest.fn().mockResolvedValue([]);
    const listFieldUpdates = jest.fn().mockResolvedValue([
      {
        auditId: 'audit-1',
        registroId: 'one',
        campoModificado: 'presupuesto_monto',
        valorAnterior: 'null',
        valorNuevo: '"80"',
        usuarioId: ANA,
        timestamp: new Date('2026-10-22T17:00:00.000Z'),
      },
    ]);
    const service = new CommercialReportsService(
      { findAll } as never,
      {
        findAll: jest
          .fn()
          .mockResolvedValue([{ userId: ANA, fullName: 'Ana Ruiz' }]),
      } as never,
      { listForEntities } as never,
      { listFieldUpdates } as never,
    );

    const details = await service.getDetails(
      {
        report: 'committee',
        kind: 'm003_amount_changes',
        year: 2026,
        quarter: 3,
        fecha_corte: '2026-10-21',
        page: 1,
        limit: 20,
      },
      actor('SoporteComercial'),
      NOW,
    );

    expect(details.items[0].previous_amount).toBeNull();
    expect(details.items[0].new_amount).toBe(80);
    expect(details.items[0].changed_by).toBe('Ana Ruiz');
    expect(details.total).toBe(1);
    expect(details.amount_total).toBe(80);
  });

  it('rejects a pipeline kind on the committee report', async () => {
    const { service } = createService();
    await expect(
      service.getDetails(
        {
          report: 'committee',
          kind: 'm023_aged',
          page: 1,
          limit: 20,
        },
        actor('Admin'),
        NOW,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('paginates detail without changing the total', async () => {
    const { service } = createService([
      ouv({ ouvId: 'b' }),
      ouv({ ouvId: 'a' }),
    ]);
    const page = await service.getDetails(
      {
        report: 'committee',
        kind: 'm003_new',
        fecha_corte: '2026-10-21',
        page: 1,
        limit: 1,
      },
      actor('Admin'),
      NOW,
    );
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.amount_total).toBe(200);
  });
});
