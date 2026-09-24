import { InfluenciaProblemException } from '../exceptions/influencia-problem.exception';
import { InfluenciaEstado, InfluenciaTipo } from '../models/enums/ouv.enums';
import { OuvInfluenciasService } from './ouv-influencias.service';

const OUV_ID = 'ouv-1';
const ACTOR = 'user-1';
const TIPO = InfluenciaTipo.Economica;

function contacto(id: string) {
  return { contactoOuvId: id, ouvId: OUV_ID };
}

describe('OuvInfluenciasService contact rules', () => {
  function build(rows: Array<Record<string, unknown>>) {
    const auditCalls: unknown[] = [];
    const store = rows.map((row) => ({ ...row }));

    const transaction = {
      LOCK: { UPDATE: 'UPDATE' },
    };

    const ouvModel = {
      sequelize: {
        transaction: async (fn: (t: typeof transaction) => Promise<unknown>) =>
          fn(transaction),
      },
      findByPk: jest.fn(async () => ({
        ouvId: OUV_ID,
        comercialId: ACTOR,
        resultado: 'EnCurso',
        consecutivo: 'OUV-0001',
        zonaActual: 'UNIVERSO',
      })),
    };

    const influenciaModel = {
      findOne: jest.fn(async ({ where }: { where: { contactoOuvId: string } }) => {
        return (
          store.find(
            (row) =>
              row.contactoOuvId === where.contactoOuvId &&
              row.tipo === TIPO &&
              !row.deletedAt,
          ) ??
          store.find(
            (row) =>
              row.contactoOuvId === where.contactoOuvId && row.tipo === TIPO,
          ) ??
          null
        );
      }),
      count: jest.fn(async () => store.filter((row) => !row.deletedAt).length),
      create: jest.fn(async (values: Record<string, unknown>) => {
        const row = {
          influenciaId: `inf-${store.length + 1}`,
          notas: null,
          estado: InfluenciaEstado.SinEvaluar,
          deletedAt: null,
          ...values,
          update: jest.fn(),
          destroy: jest.fn(async () => {
            row.deletedAt = new Date() as unknown as null;
          }),
          restore: jest.fn(),
        };
        store.push(row);
        return row;
      }),
    };

    const contactoModel = {
      findByPk: jest.fn(async (id: string) => contacto(id)),
    };

    const service = new OuvInfluenciasService(
      ouvModel as never,
      influenciaModel as never,
      contactoModel as never,
      { transition: jest.fn() } as never,
      { evaluate: jest.fn() } as never,
      {
        recordChange: jest.fn(async (entry: unknown) => {
          auditCalls.push(entry);
        }),
      } as never,
    );

    return { service, store, auditCalls, influenciaModel };
  }

  it('rejects a sixth contact on the same type', async () => {
    const rows = [1, 2, 3, 4, 5].map((n) => ({
      influenciaId: `inf-${n}`,
      ouvId: OUV_ID,
      tipo: TIPO,
      contactoOuvId: `c-${n}`,
      estado: InfluenciaEstado.SinEvaluar,
      notas: null,
      deletedAt: null,
    }));
    const { service } = build(rows);
    await expect(
      service.agregarContacto(OUV_ID, TIPO, 'c-6', ACTOR),
    ).rejects.toBeInstanceOf(InfluenciaProblemException);
  });

  it('rejects a contact already assigned to the same type', async () => {
    const { service } = build([
      {
        influenciaId: 'inf-1',
        ouvId: OUV_ID,
        tipo: TIPO,
        contactoOuvId: 'c-1',
        estado: InfluenciaEstado.Verde,
        notas: null,
        deletedAt: null,
      },
    ]);
    await expect(
      service.agregarContacto(OUV_ID, TIPO, 'c-1', ACTOR),
    ).rejects.toBeInstanceOf(InfluenciaProblemException);
  });

  it('rejects a note longer than 1000 characters', async () => {
    const row = {
      influenciaId: 'inf-1',
      ouvId: OUV_ID,
      tipo: TIPO,
      contactoOuvId: 'c-1',
      estado: InfluenciaEstado.SinEvaluar,
      notas: null,
      deletedAt: null,
      update: jest.fn(),
    };
    const { service } = build([row]);
    await expect(
      service.editarNota(OUV_ID, TIPO, 'c-1', 'x'.repeat(1001), ACTOR),
    ).rejects.toBeInstanceOf(InfluenciaProblemException);
  });

  it('audits a rating change with previous and next values', async () => {
    const row = {
      influenciaId: 'inf-1',
      ouvId: OUV_ID,
      tipo: TIPO,
      contactoOuvId: 'c-1',
      estado: InfluenciaEstado.SinEvaluar,
      notas: 'nota',
      deletedAt: null,
      update: jest.fn(async function (this: { estado: string }, values: { estado: string }) {
        this.estado = values.estado;
      }),
    };
    const { service, auditCalls } = build([row]);
    await service.calificar(
      OUV_ID,
      TIPO,
      'c-1',
      InfluenciaEstado.Verde,
      ACTOR,
    );
    expect(auditCalls).toEqual([
      expect.objectContaining({
        tabla: 'ouv_influencias',
        registroId: 'inf-1',
        campoModificado: 'estado',
        valorAnterior: InfluenciaEstado.SinEvaluar,
        valorNuevo: InfluenciaEstado.Verde,
      }),
    ]);
  });

  it('audits adding a contact', async () => {
    const { service, auditCalls } = build([]);
    await service.agregarContacto(OUV_ID, TIPO, 'c-new', ACTOR);
    expect(auditCalls).toEqual([
      expect.objectContaining({
        accion: 'INSERT',
        campoModificado: 'contacto_ouv_id',
        valorAnterior: null,
        valorNuevo: 'c-new',
      }),
    ]);
  });

  it('audits restoring a soft-deleted triple and resets rating and note', async () => {
    const row = {
      influenciaId: 'inf-old',
      ouvId: OUV_ID,
      tipo: TIPO,
      contactoOuvId: 'c-old',
      estado: InfluenciaEstado.Rojo,
      notas: 'vieja' as string | null,
      deletedAt: new Date() as Date | null,
      restore: jest.fn(async () => {
        row.deletedAt = null;
      }),
      update: jest.fn(async (values: { estado: string; notas: string | null }) => {
        row.estado = values.estado as InfluenciaEstado;
        row.notas = values.notas;
      }),
    };
    const { service, auditCalls } = build([row]);
    await service.agregarContacto(OUV_ID, TIPO, 'c-old', ACTOR);
    expect(row.restore).toHaveBeenCalled();
    expect(row.estado).toBe(InfluenciaEstado.SinEvaluar);
    expect(row.notas).toBeNull();
    expect(auditCalls).toEqual([
      expect.objectContaining({
        accion: 'INSERT',
        registroId: 'inf-old',
        valorNuevo: 'c-old',
      }),
    ]);
  });

  it('audits removing a contact', async () => {
    const row = {
      influenciaId: 'inf-1',
      ouvId: OUV_ID,
      tipo: TIPO,
      contactoOuvId: 'c-1',
      estado: InfluenciaEstado.Verde,
      notas: null,
      deletedAt: null,
      destroy: jest.fn(),
    };
    const { service, auditCalls } = build([row]);
    await service.quitarContacto(OUV_ID, TIPO, 'c-1', ACTOR);
    expect(row.destroy).toHaveBeenCalled();
    expect(auditCalls).toEqual([
      expect.objectContaining({
        accion: 'DELETE',
        registroId: 'inf-1',
        valorAnterior: 'c-1',
        valorNuevo: null,
      }),
    ]);
  });

  it('audits a note change', async () => {
    const row = {
      influenciaId: 'inf-1',
      ouvId: OUV_ID,
      tipo: TIPO,
      contactoOuvId: 'c-1',
      estado: InfluenciaEstado.SinEvaluar,
      notas: 'antes',
      deletedAt: null,
      update: jest.fn(async (values: { notas: string }) => {
        row.notas = values.notas;
      }),
    };
    const { service, auditCalls } = build([row]);
    await service.editarNota(OUV_ID, TIPO, 'c-1', 'despues', ACTOR);
    expect(auditCalls).toEqual([
      expect.objectContaining({
        accion: 'UPDATE',
        campoModificado: 'notas',
        valorAnterior: 'antes',
        valorNuevo: 'despues',
      }),
    ]);
  });

  it('returns an empty list and a failing filter when the OUV has no rows', async () => {
    const service = new OuvInfluenciasService(
      { sequelize: { transaction: jest.fn() } } as never,
      { findAll: jest.fn(async () => []) } as never,
      {} as never,
      {} as never,
      {} as never,
      { recordChange: jest.fn() } as never,
    );
    await expect(service.listByOuv(OUV_ID)).resolves.toEqual({
      rows: [],
      filtro: { passed: false, greenTypes: [], required: 2 },
    });
  });
});
