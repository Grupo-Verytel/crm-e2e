import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Op } from 'sequelize';
import { OutlookSyncStatus } from '../models/enums/outlook-sync-status.enum';
import { ReminderStatus } from '../models/enums/reminder-status.enum';
import { RemindersService, remindAtFromEvent } from './reminders.service';

const OWNER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const REMINDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('remindAtFromEvent', () => {
  it('keeps the same clock time N calendar days earlier', () => {
    const eventAt = new Date('2026-10-02T15:00:00.000Z');
    expect(remindAtFromEvent(eventAt, 0).toISOString()).toBe(
      '2026-10-02T15:00:00.000Z',
    );
    expect(remindAtFromEvent(eventAt, 2).toISOString()).toBe(
      '2026-09-30T15:00:00.000Z',
    );
  });
});

describe('RemindersService lead and SQL regression', () => {
  it('createForInteraction still accepts a past event_at and does not set an OUV source', async () => {
    const create = jest.fn(async (row: Record<string, unknown>) => ({
      reminderId: REMINDER_ID,
      interactionId: row.interactionId,
      eventAt: row.eventAt,
      remindDaysBefore: row.remindDaysBefore,
      remindAt: row.remindAt,
      note: row.note,
      status: row.status,
    }));
    const service = new RemindersService(
      { create } as never,
      {
        findByPk: jest.fn().mockResolvedValue({ leadId: 'lead-1' }),
      } as never,
      {} as never,
    );

    const result = await service.createForInteraction(
      'interaction-1',
      OWNER,
      {
        event_at: '2020-01-01T00:00:00.000Z',
        remind_days_before: 1,
        note: 'lead',
      },
      { leadId: 'lead-1' },
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER,
        interactionId: 'interaction-1',
        status: ReminderStatus.Pendiente,
      }),
    );
    expect(create.mock.calls[0][0].ouvInteractionId).toBeUndefined();
    expect(result.interaction_id).toBe('interaction-1');
    expect(result.status).toBe(ReminderStatus.Pendiente);
  });

  it('SQL createInteractionReminder still delegates and does not validate event_at', () => {
    const source = readFileSync(
      join(__dirname, '../../qualification/services/sqls.service.ts'),
      'utf8',
    );
    const start = source.indexOf('async createInteractionReminder');
    const end = source.indexOf('async registerInteraction');
    const body = source.slice(start, end);
    expect(body).toContain(
      'this.demandGenerationService.createInteractionReminder',
    );
    expect(body).not.toContain('event_at');
    expect(body).not.toContain('ouv_interaction');
  });

  it('the lead POST still forwards to createInteractionReminder', () => {
    const source = readFileSync(
      join(__dirname, '../controllers/leads.controller.ts'),
      'utf8',
    );
    const start = source.indexOf('createInteractionReminder(');
    const end = source.indexOf('@Put', start);
    const body = source.slice(start, end);
    expect(body).toContain(
      'this.demandGenerationService.createInteractionReminder',
    );
    expect(body).not.toContain('must be in the future');
  });
});

function symbolReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    const symbols = Object.getOwnPropertySymbols(value);
    if (symbols.length === 0) {
      return value;
    }
    const plain: Record<string, unknown> = {
      ...(value as Record<string, unknown>),
    };
    for (const symbol of symbols) {
      plain[symbol.description ?? 'symbol'] = (value as Record<symbol, unknown>)[
        symbol
      ];
    }
    return plain;
  }
  return value;
}

describe('RemindersService.dispatchDue', () => {
  function serviceWith(due: unknown[]) {
    const findAll = jest.fn().mockResolvedValue(due);
    const notificationCreate = jest.fn().mockResolvedValue({});
    const service = new RemindersService(
      { findAll } as never,
      {} as never,
      { create: notificationCreate } as never,
    );
    return { service, findAll, notificationCreate };
  }

  it('asks only for pending reminders that are not completed', async () => {
    const now = new Date('2026-10-17T12:00:00.000Z');
    const { service, findAll } = serviceWith([]);

    await service.dispatchDue(now);

    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReminderStatus.Pendiente,
          remindAt: { [Op.lte]: now },
          completedAt: null,
        }),
      }),
    );
    const where = findAll.mock.calls[0][0].where as unknown;
    expect(JSON.stringify(where, symbolReplacer)).toContain(
      'ouv_interactions WHERE deleted_at IS NULL',
    );
  });

  it('does not notify a reminder whose OUV interaction was deleted', async () => {
    const update = jest.fn();
    const { service, notificationCreate } = serviceWith([
      {
        reminderId: 'ouv-deleted',
        userId: OWNER,
        interactionId: null,
        ouvInteractionId: 'deleted-interaction',
        ouvInteraction: null,
        note: 'seguir',
        eventAt: new Date('2026-10-17T15:00:00.000Z'),
        interaction: null,
        update,
      },
    ]);

    await expect(service.dispatchDue()).resolves.toBe(0);
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('the notifications gateway still emits the event the bell already listens to', () => {
    const source = readFileSync(
      join(
        __dirname,
        '../../workflow-engine/gateway/notifications.gateway.ts',
      ),
      'utf8',
    );
    expect(source).toContain(".emit('notification'");
  });

  it('pushes the new notification through the existing emitToUser', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const emitToUser = jest.fn();
    const notificationCreate = jest.fn(async (attrs: Record<string, unknown>) => ({
      notificationId: '99999999-9999-4999-8999-999999999999',
      eventType: attrs.eventType,
      entityType: attrs.entityType,
      entityId: attrs.entityId,
      entityLabel: attrs.entityLabel,
      titulo: attrs.titulo,
      mensaje: attrs.mensaje,
      estadoAnterior: null,
      estadoNuevo: attrs.estadoNuevo,
      metadata: attrs.metadata,
      createdAt: new Date('2026-10-17T15:00:01.000Z'),
    }));
    const service = new RemindersService(
      {
        findAll: jest.fn().mockResolvedValue([
          {
            reminderId: REMINDER_ID,
            userId: OWNER,
            interactionId: 'interaction-1',
            note: 'llamar',
            eventAt: new Date('2026-10-17T15:00:00.000Z'),
            interaction: { sqlId: null, leadId: 'lead-1' },
            update,
          },
        ]),
      } as never,
      {} as never,
      { create: notificationCreate } as never,
      { emitToUser } as never,
    );

    await expect(service.dispatchDue()).resolves.toBe(1);
    expect(emitToUser).toHaveBeenCalledWith(
      OWNER,
      expect.objectContaining({
        notification_id: '99999999-9999-4999-8999-999999999999',
        event_type: 'interaction.reminder',
        entity_type: 'LEAD',
        entity_id: 'lead-1',
        titulo: 'Recordatorio',
        mensaje: 'llamar',
      }),
    );
  });

  it('keeps the reminder sent when the live push throws', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const service = new RemindersService(
      {
        findAll: jest.fn().mockResolvedValue([
          {
            reminderId: REMINDER_ID,
            userId: OWNER,
            interactionId: 'interaction-1',
            note: 'llamar',
            eventAt: new Date('2026-10-17T15:00:00.000Z'),
            interaction: { sqlId: null, leadId: 'lead-1' },
            update,
          },
        ]),
      } as never,
      {} as never,
      {
        create: jest.fn().mockResolvedValue({
          notificationId: '99999999-9999-4999-8999-999999999999',
          eventType: 'interaction.reminder',
          entityType: 'LEAD',
          entityId: 'lead-1',
          entityLabel: 'llamar',
          titulo: 'Recordatorio',
          mensaje: 'llamar',
          estadoNuevo: 'Recordatorio',
          metadata: null,
          createdAt: new Date(),
        }),
      } as never,
      {
        emitToUser: () => {
          throw new Error('socket down');
        },
      } as never,
    );

    await expect(service.dispatchDue()).resolves.toBe(1);
    expect(update).toHaveBeenCalledWith({ status: ReminderStatus.Enviado });
  });

  it('still sends a due lead reminder whose completed_at is null', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const { service, notificationCreate } = serviceWith([
      {
        reminderId: REMINDER_ID,
        userId: OWNER,
        interactionId: 'interaction-1',
        note: 'llamar',
        eventAt: new Date('2026-10-17T15:00:00.000Z'),
        interaction: { sqlId: null, leadId: 'lead-1' },
        update,
      },
    ]);

    await expect(service.dispatchDue()).resolves.toBe(1);
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ status: ReminderStatus.Enviado });
  });
});

describe('RemindersService complete and cancel', () => {
  function makeReminder(overrides: Record<string, unknown> = {}) {
    const reminder: Record<string, unknown> = {
      reminderId: REMINDER_ID,
      userId: OWNER,
      interactionId: 'interaction-1',
      ouvInteractionId: null,
      eventAt: new Date('2026-10-20T15:00:00.000Z'),
      remindDaysBefore: 1,
      remindAt: new Date('2026-10-19T15:00:00.000Z'),
      note: null,
      status: ReminderStatus.Pendiente,
      completedAt: null,
      deletedAt: null,
      outlookSyncStatus: OutlookSyncStatus.NotRequired,
      outlookEventId: null,
      ...overrides,
    };
    reminder.update = jest.fn(async (patch: Record<string, unknown>) => {
      Object.assign(reminder, patch);
      return reminder;
    });
    return reminder;
  }

  function serviceFor(reminder: Record<string, unknown> | null) {
    const findByPk = jest.fn().mockResolvedValue(reminder);
    const service = new RemindersService(
      { findByPk } as never,
      {} as never,
      {} as never,
    );
    return { service, findByPk };
  }

  it('sets completed_at and leaves status and Outlook untouched', async () => {
    const reminder = makeReminder({
      status: ReminderStatus.Enviado,
      outlookSyncStatus: OutlookSyncStatus.Synced,
      outlookEventId: 'graph-1',
    });
    const { service } = serviceFor(reminder);

    const result = await service.complete(REMINDER_ID, OWNER);

    expect(reminder.update).toHaveBeenCalledWith({
      completedAt: expect.any(Date),
    });
    expect(result.status).toBe(ReminderStatus.Enviado);
    expect(result.completed_at).toEqual(expect.any(Date));
    expect(result.outlook_sync_status).toBe(OutlookSyncStatus.Synced);
    expect(result.outlook_event_id).toBe('graph-1');
  });

  it('returns 403 when the actor is not the owner and does not update', async () => {
    const reminder = makeReminder();
    const { service } = serviceFor(reminder);

    await expect(service.complete(REMINDER_ID, OTHER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    try {
      await service.cancel(REMINDER_ID, OTHER);
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toEqual({
        code: 'FORBIDDEN',
        message: 'Only the reminder owner can complete or cancel it',
      });
    }
    expect(reminder.update).not.toHaveBeenCalled();
  });

  it('rejects complete when the reminder is cancelled, deleted or already done', async () => {
    for (const overrides of [
      { status: ReminderStatus.Cancelado },
      { deletedAt: new Date() },
      { completedAt: new Date('2026-10-01T00:00:00.000Z') },
    ]) {
      const reminder = makeReminder(overrides);
      const { service } = serviceFor(reminder);
      await expect(service.complete(REMINDER_ID, OWNER)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(reminder.update).not.toHaveBeenCalled();
    }
  });

  it('cancels a pending reminder and marks a synced event PENDING', async () => {
    const pending = makeReminder();
    const pendingService = serviceFor(pending).service;
    const cancelled = await pendingService.cancel(REMINDER_ID, OWNER);
    expect(cancelled.status).toBe(ReminderStatus.Cancelado);
    expect(cancelled.completed_at).toBeNull();
    expect(cancelled.outlook_sync_status).toBe(OutlookSyncStatus.NotRequired);

    const synced = makeReminder({
      outlookSyncStatus: OutlookSyncStatus.Synced,
      outlookEventId: 'graph-9',
      ouvInteractionId: 'ouv-interaction-1',
      interactionId: null,
    });
    const syncedResult = await serviceFor(synced).service.cancel(REMINDER_ID, OWNER);
    expect(synced.update).toHaveBeenCalledWith({
      status: ReminderStatus.Cancelado,
      outlookSyncStatus: OutlookSyncStatus.Pending,
    });
    expect(syncedResult.outlook_event_id).toBe('graph-9');
    expect(syncedResult.outlook_sync_status).toBe(OutlookSyncStatus.Pending);
  });

  it('rejects cancel when the reminder is not pending or is already completed', async () => {
    for (const overrides of [
      { status: ReminderStatus.Enviado },
      { status: ReminderStatus.Cancelado },
      { completedAt: new Date('2026-10-01T00:00:00.000Z') },
      { deletedAt: new Date() },
    ]) {
      const reminder = makeReminder(overrides);
      const { service } = serviceFor(reminder);
      try {
        await service.cancel(REMINDER_ID, OWNER);
        throw new Error('expected conflict');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).getResponse()).toMatchObject({
          code: 'CONFLICT',
        });
      }
      expect(reminder.update).not.toHaveBeenCalled();
    }
  });
});

describe('RemindersService.listMine', () => {
  const NOW = new Date('2026-10-17T15:00:00.000Z');
  const LEAD_ID = '11111111-1111-4111-8111-111111111111';
  const SQL_ID = '22222222-2222-4222-8222-222222222222';
  const OUV_ID = '33333333-3333-4333-8333-333333333333';
  const R_LEAD = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  const R_SQL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  const R_OUV = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  const R_GONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';

  function createService(listed: Array<{ reminder_id: string; reminder_group: string }>) {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('AS overdue')) {
        return [{ overdue: '4', today: '2', upcoming: '9' }];
      }
      if (sql.includes('COUNT(*)')) {
        return [{ total: '15' }];
      }
      return listed;
    });
    const findAll = jest.fn(async () => [
      {
        reminderId: R_LEAD,
        eventAt: new Date('2026-10-16T14:00:00.000Z'),
        remindAt: new Date('2026-10-15T14:00:00.000Z'),
        note: 'llamar',
        status: ReminderStatus.Pendiente,
        interactionId: 'int-lead',
        ouvInteractionId: null,
        interaction: {
          sqlId: null,
          leadId: LEAD_ID,
          tipo: 'Llamada',
          lead: { name: '  Acme  ' },
          sql: null,
        },
        ouvInteraction: null,
      },
      {
        reminderId: R_SQL,
        eventAt: new Date('2026-10-17T18:00:00.000Z'),
        remindAt: new Date('2026-10-16T18:00:00.000Z'),
        note: null,
        status: ReminderStatus.Enviado,
        interactionId: 'int-sql',
        ouvInteractionId: null,
        interaction: {
          sqlId: SQL_ID,
          leadId: LEAD_ID,
          tipo: 'Reunion',
          lead: { name: 'Acme' },
          sql: { sqlId: SQL_ID },
        },
        ouvInteraction: null,
      },
      {
        reminderId: R_OUV,
        eventAt: new Date('2026-10-20T15:00:00.000Z'),
        remindAt: new Date('2026-10-19T15:00:00.000Z'),
        note: 'sede',
        status: ReminderStatus.Pendiente,
        interactionId: null,
        ouvInteractionId: 'ouv-int',
        interaction: null,
        ouvInteraction: {
          ouvId: OUV_ID,
          titulo: 'Visita norte',
          ouv: { ouvId: OUV_ID, consecutivo: 'OUV-0007', titulo: 'Sede Norte' },
        },
      },
      {
        reminderId: R_GONE,
        eventAt: new Date('2026-10-01T00:00:00.000Z'),
        remindAt: new Date('2026-09-30T00:00:00.000Z'),
        note: null,
        status: ReminderStatus.Pendiente,
        interactionId: 'int-deleted',
        ouvInteractionId: null,
        interaction: null,
        ouvInteraction: null,
      },
    ]);
    const service = new RemindersService(
      { sequelize: { query }, findAll } as never,
      {} as never,
      {} as never,
    );
    return { service, query, findAll };
  }

  function sqlCalls(query: jest.Mock) {
    const list = query.mock.calls.find((call) => String(call[0]).includes('LIMIT'));
    const count = query.mock.calls.find((call) =>
      String(call[0]).includes('COUNT(*)'),
    );
    const counts = query.mock.calls.find((call) =>
      String(call[0]).includes('AS overdue'),
    );
    return {
      listSql: String(list?.[0]),
      countSql: String(count?.[0]),
      countsSql: String(counts?.[0]),
      replacements: (list?.[1] as { replacements: Record<string, unknown> })
        .replacements,
    };
  }

  it('lists only the actor and drops closed or deleted sources in SQL', async () => {
    const { service, query } = createService([]);
    await service.listMine({ page: 1, limit: 20 }, OWNER, NOW);
    const { listSql, countSql, countsSql, replacements } = sqlCalls(query);
    expect(replacements.userId).toBe(OWNER);
    for (const sql of [listSql, countSql, countsSql]) {
      expect(sql).toContain('r.user_id = :userId');
      expect(sql).toContain('r.completed_at IS NULL');
      expect(sql).toContain("r.status IN ('Pendiente', 'Enviado')");
      expect(sql).toContain('r.deleted_at IS NULL');
      expect(sql).toContain(
        'SELECT interaction_id FROM interactions WHERE deleted_at IS NULL',
      );
      expect(sql).toContain(
        'SELECT ouv_interaction_id FROM ouv_interactions WHERE deleted_at IS NULL',
      );
      expect(sql).not.toContain('Cancelado');
    }
    expect(listSql).toContain('WHEN r.event_at < :now THEN 1');
    expect(listSql).toContain('r.event_at ASC');
  });

  it('resolves LEAD, SQL and OUV labels and skips a source that is gone', async () => {
    const { service, findAll } = createService([
      { reminder_id: R_LEAD, reminder_group: 'OVERDUE' },
      { reminder_id: R_SQL, reminder_group: 'TODAY' },
      { reminder_id: R_OUV, reminder_group: 'UPCOMING' },
      { reminder_id: R_GONE, reminder_group: 'OVERDUE' },
    ]);
    const result = await service.listMine({ page: 1, limit: 20 }, OWNER, NOW);
    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ association: 'interaction' }),
          expect.objectContaining({ association: 'ouvInteraction' }),
        ]),
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        reminder_id: R_LEAD,
        group: 'OVERDUE',
        source_type: 'LEAD',
        source_id: LEAD_ID,
        source_label: 'Acme',
        interaction_title: 'Llamada',
      }),
      expect.objectContaining({
        reminder_id: R_SQL,
        group: 'TODAY',
        source_type: 'SQL',
        source_id: SQL_ID,
        source_label: 'SQL-222222',
        interaction_title: 'Reunion',
      }),
      expect.objectContaining({
        reminder_id: R_OUV,
        group: 'UPCOMING',
        source_type: 'OUV',
        source_id: OUV_ID,
        source_label: 'OUV-0007 — Sede Norte',
        interaction_title: 'Visita norte',
      }),
    ]);
    expect(result.items.some((item) => item.reminder_id === R_GONE)).toBe(false);
  });

  it('keeps counts on the full set when the page and the group filter change', async () => {
    const { service, query } = createService([
      { reminder_id: R_LEAD, reminder_group: 'OVERDUE' },
    ]);
    const result = await service.listMine(
      { page: 2, limit: 1, group: ['OVERDUE', 'TODAY'] },
      OWNER,
      NOW,
    );
    const { listSql, countSql, countsSql, replacements } = sqlCalls(query);
    expect(listSql).toContain('LIMIT 1 OFFSET 1');
    expect(listSql).toContain('IN (:groups)');
    expect(countSql).toContain('IN (:groups)');
    expect(countSql).not.toContain('LIMIT');
    expect(countsSql).not.toContain('IN (:groups)');
    expect(countsSql).not.toContain('LIMIT');
    expect(replacements.groups).toEqual(['OVERDUE', 'TODAY']);
    expect(result.total).toBe(15);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(1);
    expect(result.counts).toEqual({ OVERDUE: 4, TODAY: 2, UPCOMING: 9 });
    expect(result.items).toHaveLength(1);
  });
});
