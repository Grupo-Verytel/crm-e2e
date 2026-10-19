import { Ouv } from '../models/ouv.model';
import { OuvsService } from './ouvs.service';

function ouv(partial: Partial<Ouv> & { accountId: string | null }): Ouv {
  return {
    ouvId: partial.ouvId ?? 'ouv-1',
    consecutivo: 'OUV-0001',
    sqlIdOrigen: null,
    origenVia: 'directa',
    origin: null,
    sourceChannel: null,
    comercialId: 'user-1',
    comercial: { fullName: 'Ana' },
    titulo: 'Titulo',
    empresaNombre: 'Empresa',
    city: null,
    region: null,
    isRecurring: null,
    descripcion: null,
    segmento: 'Industria',
    segmentId: null,
    subsegmentId: null,
    vertical: 'Otros',
    zonaActual: 'UNIVERSO',
    resultado: 'EnCurso',
    tieneGap: false,
    criteriosFaltantes: null,
    presupuestoConfirmado: false,
    presupuestoMonto: null,
    presupuestoMoneda: null,
    presupuestoFechaCaptura: null,
    presupuestoFuente: null,
    motivoId: null,
    motivoSnapshot: null,
    motivoDetalle: null,
    competidorGanador: null,
    montoFinal: null,
    monedaFinal: null,
    montoEstimadoPerdido: null,
    fechaCierre: null,
    plazoEjecucionMeses: null,
    expectedCloseDate: null,
    createdAt: new Date('2026-10-18T00:00:00.000Z'),
    updatedAt: new Date('2026-10-18T00:00:00.000Z'),
    ...partial,
  } as Ouv;
}

function serviceWith(findHighValueByAccountIds: jest.Mock) {
  return new OuvsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { findHighValueByAccountIds } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('OUV account_is_high_value', () => {
  it('REQ-05: one lookup for the page, false when the account is missing or null', async () => {
    const findHighValueByAccountIds = jest.fn(() =>
      Promise.resolve(new Map<string, boolean>([['acc-high', true]])),
    );
    const service = serviceWith(findHighValueByAccountIds);

    const items = await service.presentPage([
      ouv({
        ouvId: 'ouv-high',
        accountId: 'acc-high',
        consecutivo: 'OUV-0002',
      }),
      ouv({ ouvId: 'ouv-low', accountId: 'acc-low' }),
      ouv({ ouvId: 'ouv-none', accountId: null }),
    ]);

    expect(findHighValueByAccountIds).toHaveBeenCalledTimes(1);
    expect(findHighValueByAccountIds).toHaveBeenCalledWith([
      'acc-high',
      'acc-low',
    ]);
    expect(items.map((item) => item.account_is_high_value)).toEqual([
      true,
      false,
      false,
    ]);
    expect(items[0]).toMatchObject({
      ouv_id: 'ouv-high',
      consecutivo: 'OUV-0002',
      empresa_nombre: 'Empresa',
      account_id: 'acc-high',
      titulo: 'Titulo',
    });
  });

  it('REQ-06: a null account_id does not query accounts', async () => {
    const findHighValueByAccountIds = jest.fn();
    const service = serviceWith(findHighValueByAccountIds);

    const dto = await service.present(ouv({ accountId: null }));

    expect(dto.account_is_high_value).toBe(false);
    expect(findHighValueByAccountIds).not.toHaveBeenCalled();
  });
});
