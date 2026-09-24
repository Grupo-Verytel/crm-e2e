import { AuditAction } from '../../audit/models/audit-action.enum';
import { OuvContactosService } from './ouv-contactos.service';

describe('OuvContactosService influencia cascade audit', () => {
  it('writes one DELETE audit row per influencia when the contact is removed', async () => {
    const auditCalls: unknown[] = [];
    const rows = [
      {
        influenciaId: 'inf-eco',
        contactoOuvId: 'contacto-1',
        destroy: jest.fn(),
      },
      {
        influenciaId: 'inf-tec',
        contactoOuvId: 'contacto-1',
        destroy: jest.fn(),
      },
    ];
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const contacto = {
      contactoOuvId: 'contacto-1',
      ouvId: 'ouv-1',
      personId: 'person-1',
      destroy: jest.fn(),
    };
    const service = new OuvContactosService(
      {
        sequelize: {
          transaction: async (fn: (t: typeof transaction) => Promise<unknown>) =>
            fn(transaction),
        },
        findByPk: jest.fn(async () => ({
          ouvId: 'ouv-1',
          comercialId: 'user-1',
          resultado: 'EnCurso',
          consecutivo: 'OUV-0001',
          zonaActual: 'UNIVERSO',
        })),
      } as never,
      {
        findByPk: jest.fn(async () => contacto),
      } as never,
      {
        findAll: jest.fn(async () => rows),
      } as never,
      {} as never,
      {} as never,
      { transition: jest.fn() } as never,
      {
        recordChange: jest.fn(async (entry: unknown) => {
          auditCalls.push(entry);
        }),
      } as never,
    );

    await service.eliminar('contacto-1', 'user-1', 'EjecutivoComercial');

    expect(rows[0].destroy).toHaveBeenCalled();
    expect(rows[1].destroy).toHaveBeenCalled();
    expect(auditCalls).toEqual([
      expect.objectContaining({
        tabla: 'ouv_influencias',
        registroId: 'inf-eco',
        accion: AuditAction.DELETE,
      }),
      expect.objectContaining({
        tabla: 'ouv_influencias',
        registroId: 'inf-tec',
        accion: AuditAction.DELETE,
      }),
    ]);
  });
});
