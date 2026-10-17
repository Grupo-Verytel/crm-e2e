import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OuvResultado } from '../models/enums/ouv.enums';
import { OuvInteraccionesService } from './ouv-interacciones.service';

const OUV_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACTOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('OuvInteraccionesService reminders', () => {
  function setup() {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    let committed = false;
    let rolledBack = false;
    const ouvModel = {
      sequelize: {
        transaction: jest.fn(async (fn: (tx: typeof transaction) => Promise<unknown>) => {
          try {
            const result = await fn(transaction);
            committed = true;
            return result;
          } catch (error) {
            rolledBack = true;
            throw error;
          }
        }),
      },
      findByPk: jest.fn(),
    };
    const interactionModel = {
      create: jest.fn(async (row: Record<string, unknown>) => ({
        ...row,
        etiquetas: [],
        createdAt: row.fechaRegistrada,
        hilos: [],
      })),
    };
    const reminderModel = {
      create: jest.fn(),
      findAll: jest.fn(),
    };
    const userModel = {
      findByPk: jest.fn().mockResolvedValue({ fullName: 'Ana Ruiz' }),
    };
    const configService = { get: jest.fn().mockReturnValue(undefined) };
    const service = new OuvInteraccionesService(
      ouvModel as never,
      interactionModel as never,
      {} as never,
      userModel as never,
      reminderModel as never,
      configService as never,
    );

    function openOuv(comercialId = ACTOR_ID) {
      ouvModel.findByPk.mockResolvedValue({
        ouvId: OUV_ID,
        comercialId,
        resultado: OuvResultado.EnCurso,
      });
    }

    return {
      service,
      ouvModel,
      interactionModel,
      reminderModel,
      configService,
      transaction,
      openOuv,
      flags: () => ({ committed, rolledBack }),
    };
  }

  it('creates an interaction without a reminder and leaves recordatorio null', async () => {
    const { service, interactionModel, reminderModel, openOuv, flags } = setup();
    openOuv();

    const result = await service.crear(
      OUV_ID,
      { titulo: 'Llamada' },
      ACTOR_ID,
      'EjecutivoComercial',
    );

    expect(reminderModel.create).not.toHaveBeenCalled();
    expect(interactionModel.create).toHaveBeenCalledTimes(1);
    expect(result.recordatorio).toBeNull();
    expect(result.titulo).toBe('Llamada');
    expect(flags().committed).toBe(true);
  });

  it('creates the reminder inside the same transaction as the interaction', async () => {
    const {
      service,
      interactionModel,
      reminderModel,
      transaction,
      openOuv,
    } = setup();
    openOuv();
    const eventAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    reminderModel.create.mockImplementation(async (row: Record<string, unknown>) => ({
      reminderId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      ...row,
      completedAt: null,
    }));

    const result = await service.crear(
      OUV_ID,
      {
        titulo: 'Seguimiento',
        recordatorio: { event_at: eventAt, note: '  Llamar  ' },
      },
      ACTOR_ID,
      'EjecutivoComercial',
    );

    expect(interactionModel.create).toHaveBeenCalledWith(
      expect.any(Object),
      { transaction },
    );
    const reminderRow = reminderModel.create.mock.calls[0][0];
    expect(reminderModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ACTOR_ID,
        interactionId: null,
        status: 'Pendiente',
        remindDaysBefore: 1,
        note: 'Llamar',
        outlookSyncStatus: 'NOT_REQUIRED',
      }),
      { transaction },
    );
    expect(reminderRow.ouvInteractionId).toBe(
      interactionModel.create.mock.calls[0][0].ouvInteractionId,
    );
    expect(reminderRow.remindAt.getTime()).toBe(
      new Date(eventAt).getTime() - 24 * 60 * 60 * 1000,
    );
    expect(result.recordatorio).toMatchObject({
      user_id: ACTOR_ID,
      status: 'Pendiente',
      remind_days_before: 1,
      note: 'Llamar',
      outlook_sync_status: 'NOT_REQUIRED',
      completed_at: null,
    });
  });

  it('accepts a past remind_at when event_at is still in the future', async () => {
    const { service, reminderModel, openOuv } = setup();
    openOuv();
    const eventAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    reminderModel.create.mockImplementation(async (row: Record<string, unknown>) => ({
      reminderId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      ...row,
      completedAt: null,
    }));

    await service.crear(
      OUV_ID,
      {
        titulo: 'Pronto',
        recordatorio: {
          event_at: eventAt.toISOString(),
          remind_days_before: 1,
        },
      },
      ACTOR_ID,
      'SoporteComercial',
    );

    const remindAt = reminderModel.create.mock.calls[0][0].remindAt as Date;
    expect(remindAt.getTime()).toBeLessThan(Date.now());
  });

  it('rejects a past event_at before inserting the interaction or the reminder', async () => {
    const { service, interactionModel, reminderModel, openOuv, flags } = setup();
    openOuv();

    await expect(
      service.crear(
        OUV_ID,
        {
          titulo: 'Tarde',
          recordatorio: { event_at: '2020-01-01T00:00:00.000Z' },
        },
        ACTOR_ID,
        'EjecutivoComercial',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    try {
      await service.crear(
        OUV_ID,
        {
          titulo: 'Tarde',
          recordatorio: { event_at: '2020-01-01T00:00:00.000Z' },
        },
        ACTOR_ID,
        'EjecutivoComercial',
      );
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'event_at must be in the future',
      });
    }

    expect(interactionModel.create).not.toHaveBeenCalled();
    expect(reminderModel.create).not.toHaveBeenCalled();
    expect(flags().rolledBack).toBe(true);
    expect(flags().committed).toBe(false);
  });

  it('rolls the transaction back when the reminder insert fails', async () => {
    const { service, interactionModel, reminderModel, transaction, openOuv, flags } =
      setup();
    openOuv();
    reminderModel.create.mockRejectedValue(new Error('check failed'));

    await expect(
      service.crear(
        OUV_ID,
        {
          titulo: 'Seguimiento',
          recordatorio: { event_at: '2099-01-01T15:00:00.000Z', remind_days_before: 0 },
        },
        ACTOR_ID,
        'Admin',
      ),
    ).rejects.toThrow('check failed');

    expect(interactionModel.create).toHaveBeenCalledWith(
      expect.any(Object),
      { transaction },
    );
    expect(reminderModel.create).toHaveBeenCalledWith(
      expect.any(Object),
      { transaction },
    );
    expect(flags().rolledBack).toBe(true);
    expect(flags().committed).toBe(false);
  });

  it('stores PENDING when OUTLOOK_SYNC_ENABLED is true and NOT_REQUIRED otherwise', async () => {
    const { service, reminderModel, configService, openOuv } = setup();
    openOuv();
    reminderModel.create.mockImplementation(async (row: Record<string, unknown>) => ({
      reminderId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      ...row,
      completedAt: null,
    }));
    const dto = {
      titulo: 'Outlook',
      recordatorio: { event_at: '2099-06-01T15:00:00.000Z', remind_days_before: 2 },
    };

    configService.get.mockReturnValue('false');
    await service.crear(OUV_ID, dto, ACTOR_ID, 'Admin');
    expect(reminderModel.create.mock.calls[0][0].outlookSyncStatus).toBe(
      'NOT_REQUIRED',
    );

    configService.get.mockReturnValue('true');
    await service.crear(OUV_ID, dto, ACTOR_ID, 'Admin');
    expect(reminderModel.create.mock.calls[1][0].outlookSyncStatus).toBe('PENDING');
  });

  it('hides another ejecutivo OUV and lists own reminders by event_at', async () => {
    const { service, ouvModel, reminderModel } = setup();
    ouvModel.findByPk.mockResolvedValue({
      ouvId: OUV_ID,
      comercialId: OTHER_ID,
    });

    await expect(
      service.listRecordatorios(OUV_ID, ACTOR_ID, 'EjecutivoComercial'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reminderModel.findAll).not.toHaveBeenCalled();

    ouvModel.findByPk.mockResolvedValue({
      ouvId: OUV_ID,
      comercialId: ACTOR_ID,
    });
    reminderModel.findAll.mockResolvedValue([
      {
        reminderId: 'r1',
        ouvInteractionId: 'i1',
        userId: ACTOR_ID,
        eventAt: new Date('2026-10-20T15:00:00.000Z'),
        remindDaysBefore: 1,
        remindAt: new Date('2026-10-19T15:00:00.000Z'),
        note: null,
        status: 'Pendiente',
        completedAt: null,
        outlookSyncStatus: 'NOT_REQUIRED',
        user: { fullName: 'Ana Ruiz' },
        ouvInteraction: { titulo: 'Visita' },
      },
    ]);

    const rows = await service.listRecordatorios(
      OUV_ID,
      ACTOR_ID,
      'EjecutivoComercial',
    );

    expect(reminderModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        order: [['eventAt', 'ASC']],
        include: expect.arrayContaining([
          expect.objectContaining({
            where: { ouvId: OUV_ID, deletedAt: null },
          }),
        ]),
      }),
    );
    expect(rows[0]).toMatchObject({
      reminder_id: 'r1',
      status: 'Pendiente',
      completed_at: null,
      user_id: ACTOR_ID,
      responsable_nombre: 'Ana Ruiz',
      interaccion_titulo: 'Visita',
    });
  });

  it('lets SoporteComercial list reminders of an OUV they do not own', async () => {
    const { service, ouvModel, reminderModel } = setup();
    ouvModel.findByPk.mockResolvedValue({
      ouvId: OUV_ID,
      comercialId: OTHER_ID,
    });
    reminderModel.findAll.mockResolvedValue([]);

    await expect(
      service.listRecordatorios(OUV_ID, ACTOR_ID, 'SoporteComercial'),
    ).resolves.toEqual([]);
    expect(reminderModel.findAll).toHaveBeenCalled();
  });

  it('cancels a pending reminder when the interaction is deleted and leaves a completed one', async () => {
    const { service, ouvModel, interactionModel, reminderModel, transaction } =
      setup();
    const replyDestroy = jest.fn().mockResolvedValue(undefined);
    const interactionDestroy = jest.fn().mockResolvedValue(undefined);
    (service as unknown as { replyModel: { destroy: jest.Mock } }).replyModel =
      { destroy: replyDestroy };
    ouvModel.findByPk.mockResolvedValue({
      ouvId: OUV_ID,
      comercialId: ACTOR_ID,
      resultado: OuvResultado.EnCurso,
    });
    interactionModel.findOne = jest.fn().mockResolvedValue({
      ouvInteractionId: 'interaction-1',
      destroy: interactionDestroy,
    });
    const pending = {
      status: 'Pendiente',
      completedAt: null,
      outlookSyncStatus: 'SYNCED',
      outlookEventId: 'graph-1',
      update: jest.fn(async function update(
        this: Record<string, unknown>,
        patch: Record<string, unknown>,
      ) {
        Object.assign(this, patch);
      }),
    };
    const completed = {
      status: 'Pendiente',
      completedAt: new Date('2026-10-01T00:00:00.000Z'),
      outlookSyncStatus: 'SYNCED',
      outlookEventId: 'graph-2',
      update: jest.fn(),
    };
    reminderModel.findAll.mockImplementation(
      async (options: { where: { status: string; completedAt: null } }) => {
        expect(options.where).toEqual({
          ouvInteractionId: 'interaction-1',
          status: 'Pendiente',
          completedAt: null,
        });
        expect(options).toEqual(
          expect.objectContaining({ transaction, lock: 'UPDATE' }),
        );
        return [pending].filter(
          (row) =>
            row.status === options.where.status && row.completedAt === null,
        );
      },
    );

    await service.eliminar(OUV_ID, 'interaction-1', ACTOR_ID, 'EjecutivoComercial');

    expect(pending.update).toHaveBeenCalledWith(
      { status: 'Cancelado', outlookSyncStatus: 'PENDING' },
      { transaction },
    );
    expect(pending.outlookEventId).toBe('graph-1');
    expect(completed.update).not.toHaveBeenCalled();
    expect(replyDestroy).toHaveBeenCalled();
    expect(interactionDestroy).toHaveBeenCalledWith({ transaction });
  });
});
