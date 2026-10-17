import {
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OutlookSyncStatus } from '../models/enums/outlook-sync-status.enum';
import { ReminderStatus } from '../models/enums/reminder-status.enum';
import {
  OUTLOOK_CANDIDATE_SQL,
  OUTLOOK_LOCK_SQL,
  OUTLOOK_MAILBOX_FORBIDDEN,
  OUTLOOK_UNAUTHORIZED_TENANT,
  buildOutlookEvent,
  readOutlookSyncConfig,
} from '../lib/outlook-sync';
import { OutlookReminderSyncService } from './outlook-reminder-sync.service';

const REMINDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SECOND_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const OUV_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT_AT = new Date('2026-11-01T15:00:00.000Z');

type PostedEvent = {
  subject?: string;
  transactionId?: string;
  isReminderOn?: boolean;
  reminderMinutesBeforeStart?: number;
  showAs?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  body?: { contentType?: string; content?: string };
};

type GraphResult = { id?: string } | undefined;

type State = {
  reminderId: string;
  status: ReminderStatus;
  completedAt: Date | null;
  outlookEventId: string | null;
  outlookSyncStatus: OutlookSyncStatus;
  outlookSyncAttempts: number;
  note: string | null;
};

function enabledEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    OUTLOOK_SYNC_ENABLED: 'true',
    OUTLOOK_SYNC_MAX_ATTEMPTS: '5',
    OUTLOOK_SYNC_INTERVAL_MS: '60000',
    CRM_PUBLIC_URL: 'https://crm.example/',
    ...overrides,
  };
}

function harness(
  env: Record<string, string | undefined> = enabledEnv(),
  email = 'ana@grupoverytel.com',
) {
  const maxAttempts = Number(env.OUTLOOK_SYNC_MAX_ATTEMPTS || 5);
  const states = new Map<string, State>();
  const updates: Array<{
    id: string;
    patch: Record<string, unknown>;
    transaction?: unknown;
  }> = [];
  const calls: Array<{ method: string; path: string; data?: PostedEvent }> = [];
  const queue: Array<() => Promise<GraphResult>> = [];
  let fallback: () => Promise<GraphResult> = () =>
    Promise.resolve({ id: 'evt-1' });
  const request = (
    method: string,
    path: string,
    options?: { data?: PostedEvent },
  ): Promise<GraphResult> => {
    calls.push({ method, path, data: options?.data });
    const next = queue.shift() ?? fallback;
    return next();
  };
  const graph = {
    calls,
    resolve(body: GraphResult) {
      queue.push(() => Promise.resolve(body));
    },
    reject(error: Error) {
      queue.push(() => Promise.reject(error));
    },
    resolveAlways(body: GraphResult) {
      fallback = () => Promise.resolve(body);
    },
  };
  const tx = { id: 'tx' };
  const query = jest.fn(
    (sql: string, options?: { replacements?: { reminderId?: string } }) => {
      const text = String(sql);
      if (text.includes('LIMIT 20')) {
        return [...states.values()]
          .filter(
            (state) =>
              state.outlookSyncAttempts < maxAttempts &&
              (state.outlookSyncStatus === OutlookSyncStatus.Pending ||
                state.outlookSyncStatus === OutlookSyncStatus.Failed),
          )
          .map((state) => ({ reminder_id: state.reminderId }));
      }
      if (text.includes('FOR UPDATE')) {
        const state = states.get(options?.replacements?.reminderId ?? '');
        if (
          !state ||
          state.outlookSyncAttempts >= maxAttempts ||
          (state.outlookSyncStatus !== OutlookSyncStatus.Pending &&
            state.outlookSyncStatus !== OutlookSyncStatus.Failed)
        ) {
          return [];
        }
        return [{ reminder_id: state.reminderId }];
      }
      if (text.includes('users')) {
        return [
          {
            email,
            titulo: 'Llamada',
            ouv_id: OUV_ID,
            consecutivo: 'OUV-26-0001',
          },
        ];
      }
      return [];
    },
  );
  const reminderModel = {
    sequelize: {
      query,
      transaction: jest.fn((fn: (transaction: typeof tx) => unknown) => fn(tx)),
    },
    findByPk: jest.fn((id: string) => {
      const state = states.get(id);
      if (!state) {
        return null;
      }
      return {
        get reminderId() {
          return state.reminderId;
        },
        get status() {
          return state.status;
        },
        get completedAt() {
          return state.completedAt;
        },
        get outlookEventId() {
          return state.outlookEventId;
        },
        get outlookSyncAttempts() {
          return state.outlookSyncAttempts;
        },
        get note() {
          return state.note;
        },
        eventAt: EVENT_AT,
        remindDaysBefore: 2,
        update(
          patch: Record<string, unknown>,
          options?: { transaction?: unknown },
        ) {
          updates.push({ id, patch, transaction: options?.transaction });
          if (typeof patch.outlookSyncAttempts === 'number') {
            state.outlookSyncAttempts = patch.outlookSyncAttempts;
          }
          if (
            patch.outlookSyncStatus === OutlookSyncStatus.Pending ||
            patch.outlookSyncStatus === OutlookSyncStatus.Synced ||
            patch.outlookSyncStatus === OutlookSyncStatus.Failed ||
            patch.outlookSyncStatus === OutlookSyncStatus.NotRequired
          ) {
            state.outlookSyncStatus = patch.outlookSyncStatus;
          }
          if ('outlookEventId' in patch) {
            state.outlookEventId =
              typeof patch.outlookEventId === 'string'
                ? patch.outlookEventId
                : null;
          }
        },
      };
    }),
  };

  const service = new OutlookReminderSyncService(
    reminderModel as never,
    { request } as never,
    { get: (key: string) => env[key] } as never,
  );

  function seed(partial: Partial<State> & { reminderId?: string } = {}) {
    const reminderId = partial.reminderId ?? REMINDER_ID;
    states.set(reminderId, {
      reminderId,
      status: partial.status ?? ReminderStatus.Pendiente,
      completedAt: partial.completedAt ?? null,
      outlookEventId: partial.outlookEventId ?? null,
      outlookSyncStatus: partial.outlookSyncStatus ?? OutlookSyncStatus.Pending,
      outlookSyncAttempts: partial.outlookSyncAttempts ?? 0,
      note: partial.note === undefined ? 'nota <b>' : partial.note,
    });
  }

  return { service, graph, query, updates, seed, tx, states };
}

function expectCrmUntouched(patch: Record<string, unknown>) {
  expect(patch).not.toHaveProperty('status');
  expect(patch).not.toHaveProperty('completedAt');
}

describe('buildOutlookEvent alarm cap', () => {
  it('sends 40320 minutes when remind_days_before is 30', () => {
    const event = buildOutlookEvent({
      reminderId: REMINDER_ID,
      consecutivo: 'OUV-26-0001',
      titulo: 'Llamada',
      note: null,
      eventAt: EVENT_AT,
      remindDaysBefore: 30,
      ouvId: OUV_ID,
      publicUrl: 'https://crm.example',
    });

    expect(event.reminderMinutesBeforeStart).toBe(40320);
  });
});

describe('readOutlookSyncConfig', () => {
  it('defaults the flag to off and does not require the public URL', () => {
    expect(readOutlookSyncConfig({ get: () => undefined })).toEqual({
      enabled: false,
      maxAttempts: 5,
      intervalMs: 60_000,
      publicUrl: null,
    });
  });

  it('rejects an enabled flag without a public URL and other invalid values', () => {
    expect(() =>
      readOutlookSyncConfig({
        get: (key) => (key === 'OUTLOOK_SYNC_ENABLED' ? 'true' : undefined),
      }),
    ).toThrow(/CRM_PUBLIC_URL/);
    expect(() =>
      readOutlookSyncConfig({
        get: (key) =>
          key === 'OUTLOOK_SYNC_MAX_ATTEMPTS'
            ? '0'
            : key === 'OUTLOOK_SYNC_ENABLED'
              ? 'false'
              : undefined,
      }),
    ).toThrow(/OUTLOOK_SYNC_MAX_ATTEMPTS/);
    expect(() =>
      readOutlookSyncConfig({
        get: (key) => (key === 'OUTLOOK_SYNC_INTERVAL_MS' ? '999' : undefined),
      }),
    ).toThrow(/OUTLOOK_SYNC_INTERVAL_MS/);
    expect(() =>
      readOutlookSyncConfig({
        get: (key) => (key === 'OUTLOOK_SYNC_ENABLED' ? 'yes' : undefined),
      }),
    ).toThrow(/OUTLOOK_SYNC_ENABLED/);
  });
});

describe('OutlookReminderSyncService', () => {
  const logged: string[] = [];

  beforeEach(() => {
    logged.length = 0;
    const record = (message: unknown) => {
      if (typeof message === 'string') {
        logged.push(message);
      }
    };
    jest.spyOn(Logger.prototype, 'log').mockImplementation(record);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(record);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(record);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates an event and stores the Graph id', async () => {
    const { service, graph, updates, seed } = harness();
    seed();

    await service.runCycle();

    expect(graph.calls).toHaveLength(1);
    expect(graph.calls[0].method).toBe('POST');
    expect(graph.calls[0].path).toBe('/users/ana%40grupoverytel.com/events');
    expect(graph.calls[0].data?.subject).toBe(
      'Recordatorio CRM: OUV-26-0001 — Llamada',
    );
    expect(graph.calls[0].data?.transactionId).toBe(REMINDER_ID);
    expect(graph.calls[0].data?.isReminderOn).toBe(true);
    expect(graph.calls[0].data?.reminderMinutesBeforeStart).toBe(2880);
    expect(graph.calls[0].data?.showAs).toBe('free');
    expect(graph.calls[0].data?.start).toEqual({
      dateTime: '2026-11-01T15:00:00',
      timeZone: 'UTC',
    });
    expect(graph.calls[0].data?.end).toEqual({
      dateTime: '2026-11-01T15:30:00',
      timeZone: 'UTC',
    });
    const body = graph.calls[0].data?.body?.content ?? '';
    expect(body).toContain('nota &lt;b&gt;');
    expect(body).toContain(
      `https://crm.example/opportunities/${OUV_ID}?tab=recordatorios`,
    );
    expect(updates[0].patch).toEqual(
      expect.objectContaining({
        outlookEventId: 'evt-1',
        outlookSyncStatus: OutlookSyncStatus.Synced,
        outlookLastError: null,
      }),
    );
    expect(updates[0].patch.outlookSyncedAt).toEqual(expect.any(Date));
    expectCrmUntouched(updates[0].patch);
    const text = logged.join(' ');
    expect(text).not.toContain('nota <b>');
    expect(text).not.toContain('evt-1');
  });

  it('retries a create after a 5xx and then syncs', async () => {
    const { service, graph, updates, seed, states } = harness();
    seed();
    graph.reject(
      new HttpException({ message: 'x'.repeat(600), code: 'ServerError' }, 503),
    );
    graph.resolve({ id: 'evt-retry' });

    await service.runCycle();
    expect(states.get(REMINDER_ID)?.outlookSyncAttempts).toBe(1);
    expect(states.get(REMINDER_ID)?.outlookSyncStatus).toBe(
      OutlookSyncStatus.Failed,
    );
    expect(updates[0].patch.outlookLastError).toEqual('x'.repeat(500));
    expectCrmUntouched(updates[0].patch);

    await service.runCycle();
    expect(graph.calls).toHaveLength(2);
    expect(states.get(REMINDER_ID)?.outlookSyncStatus).toBe(
      OutlookSyncStatus.Synced,
    );
    expect(states.get(REMINDER_ID)?.outlookEventId).toBe('evt-retry');
  });

  it('counts a network failure as a retryable 5xx', async () => {
    const { service, graph, seed, states } = harness();
    seed();
    graph.reject(
      new ServiceUnavailableException(
        'No se pudo contactar Microsoft Graph: ECONNRESET',
      ),
    );

    await service.runCycle();

    expect(states.get(REMINDER_ID)?.outlookSyncAttempts).toBe(1);
    expect(states.get(REMINDER_ID)?.outlookSyncStatus).toBe(
      OutlookSyncStatus.Failed,
    );
  });

  it('fails a 403 permanently', async () => {
    const { service, graph, updates, seed, states } = harness();
    seed();
    graph.reject(
      new HttpException(
        { message: 'Access denied', code: 'ErrorAccessDenied' },
        403,
      ),
    );

    await service.runCycle();
    await service.runCycle();

    expect(graph.calls).toHaveLength(1);
    expect(states.get(REMINDER_ID)?.outlookSyncAttempts).toBe(5);
    expect(states.get(REMINDER_ID)?.outlookSyncStatus).toBe(
      OutlookSyncStatus.Failed,
    );
    expect(updates[0].patch.outlookLastError).toBe(
      `${OUTLOOK_MAILBOX_FORBIDDEN} (403)`,
    );
    expectCrmUntouched(updates[0].patch);
  });

  it('rejects a mailbox outside grupoverytel.com without calling Graph', async () => {
    const { service, graph, updates, seed } = harness(
      enabledEnv(),
      'ana@frisson.net.co',
    );
    seed();

    await service.runCycle();

    expect(graph.calls).toHaveLength(0);
    expect(updates[0].patch).toEqual({
      outlookSyncStatus: OutlookSyncStatus.Failed,
      outlookSyncAttempts: 5,
      outlookLastError: OUTLOOK_UNAUTHORIZED_TENANT,
    });
  });

  it('does not consume an attempt on 429 and stops the cycle', async () => {
    const { service, graph, updates, seed } = harness();
    seed({ reminderId: REMINDER_ID });
    seed({ reminderId: SECOND_ID });
    graph.reject(
      new HttpException(
        { message: 'slow down', code: 'TooManyRequests', retryAfter: '120' },
        429,
      ),
    );

    await service.runCycle();
    await service.runCycle();

    expect(graph.calls).toHaveLength(1);
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe(REMINDER_ID);
    expect(updates[0].patch).toEqual({ outlookLastError: 'slow down' });
    expectCrmUntouched(updates[0].patch);
  });

  it('stops the current cycle on 429 without Retry-After and continues later', async () => {
    const { service, graph, seed, states } = harness();
    seed({ reminderId: REMINDER_ID });
    seed({ reminderId: SECOND_ID });
    graph.reject(
      new HttpException({ message: 'slow down', code: 'TooManyRequests' }, 429),
    );
    graph.resolveAlways({ id: 'evt-later' });

    await service.runCycle();
    expect(graph.calls).toHaveLength(1);
    expect(states.get(REMINDER_ID)?.outlookSyncAttempts).toBe(0);

    await service.runCycle();
    expect(graph.calls).toHaveLength(3);
  });

  it('deletes a synced event and clears the id', async () => {
    const { service, graph, updates, seed, tx } = harness();
    seed({
      status: ReminderStatus.Cancelado,
      outlookEventId: 'evt-9',
      outlookSyncStatus: OutlookSyncStatus.Pending,
    });
    graph.resolve(undefined);

    await service.runCycle();

    expect(graph.calls[0]).toEqual({
      method: 'DELETE',
      path: '/users/ana%40grupoverytel.com/events/evt-9',
      data: undefined,
    });
    expect(updates[0].patch).toEqual(
      expect.objectContaining({
        outlookEventId: null,
        outlookSyncStatus: OutlookSyncStatus.NotRequired,
        outlookLastError: null,
      }),
    );
    expect(updates[0].transaction).toBe(tx);
    expectCrmUntouched(updates[0].patch);
  });

  it('treats a delete 404 as success', async () => {
    const { service, graph, updates, seed, states } = harness();
    seed({
      status: ReminderStatus.Cancelado,
      outlookEventId: 'evt-gone',
      outlookSyncStatus: OutlookSyncStatus.Failed,
      outlookSyncAttempts: 1,
    });
    graph.reject(
      new HttpException(
        {
          message: 'The specified object was not found',
          code: 'ErrorItemNotFound',
        },
        404,
      ),
    );

    await service.runCycle();

    expect(states.get(REMINDER_ID)?.outlookEventId).toBeNull();
    expect(states.get(REMINDER_ID)?.outlookSyncStatus).toBe(
      OutlookSyncStatus.NotRequired,
    );
    expect(states.get(REMINDER_ID)?.outlookSyncAttempts).toBe(1);
    expectCrmUntouched(updates[0].patch);
  });

  it('marks a cancellation that never synced as not required', async () => {
    const { service, graph, updates, seed } = harness();
    seed({
      status: ReminderStatus.Cancelado,
      outlookEventId: null,
    });

    await service.runCycle();

    expect(graph.calls).toHaveLength(0);
    expect(updates[0].patch).toEqual({
      outlookSyncStatus: OutlookSyncStatus.NotRequired,
      outlookLastError: null,
    });
  });

  it('does not call Graph for a completed reminder', async () => {
    const { service, graph, updates, seed } = harness();
    seed({ completedAt: new Date('2026-10-17T12:00:00.000Z') });

    await service.runCycle();

    expect(graph.calls).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it('stops at the attempt cap', async () => {
    const { service, graph, seed, states } = harness();
    seed({ outlookSyncAttempts: 4 });
    graph.reject(
      new HttpException({ message: 'down', code: 'ServerError' }, 500),
    );

    await service.runCycle();
    expect(states.get(REMINDER_ID)?.outlookSyncAttempts).toBe(5);
    expect(graph.calls).toHaveLength(1);

    await service.runCycle();
    expect(graph.calls).toHaveLength(1);
  });

  it('does not create a second event when outlook_event_id is already set', async () => {
    const { service, graph, updates, seed, states } = harness();
    seed({
      status: ReminderStatus.Enviado,
      outlookEventId: 'evt-keep',
    });

    await service.runCycle();

    expect(graph.calls).toHaveLength(0);
    expect(states.get(REMINDER_ID)?.outlookEventId).toBe('evt-keep');
    expect(updates[0].patch.outlookSyncStatus).toBe(OutlookSyncStatus.Synced);
    expectCrmUntouched(updates[0].patch);
  });

  it('does not start the job when the flag is off', async () => {
    const interval = jest.spyOn(global, 'setInterval');
    const { service, query } = harness({ OUTLOOK_SYNC_ENABLED: 'false' });

    service.onModuleInit();
    await service.runCycle();

    expect(interval).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    service.onModuleDestroy();
  });

  it('starts and stops the interval when the flag is on', () => {
    const interval = jest.spyOn(global, 'setInterval');
    const clear = jest.spyOn(global, 'clearInterval');
    const { service } = harness();

    service.onModuleInit();
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 60_000);
    service.onModuleDestroy();
    expect(clear).toHaveBeenCalled();
  });

  it('only selects OUV reminders under the attempt cap', () => {
    expect(OUTLOOK_CANDIDATE_SQL).toContain('ouv_interaction_id IS NOT NULL');
    expect(OUTLOOK_CANDIDATE_SQL).toContain('completed_at IS NULL');
    expect(OUTLOOK_CANDIDATE_SQL).toContain(
      "outlook_sync_status IN ('PENDING', 'FAILED')",
    );
    expect(OUTLOOK_CANDIDATE_SQL).toContain(
      'outlook_sync_attempts < :maxAttempts',
    );
    expect(OUTLOOK_CANDIDATE_SQL).toContain('LIMIT 20');
    expect(OUTLOOK_LOCK_SQL).toContain('reminder_id = :reminderId');
    expect(OUTLOOK_LOCK_SQL).toContain('FOR UPDATE SKIP LOCKED');
  });
});
