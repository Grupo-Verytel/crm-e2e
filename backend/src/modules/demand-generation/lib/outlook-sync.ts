import { HttpException } from '@nestjs/common';

export const OUTLOOK_SYNC_BATCH_LIMIT = 20;
export const OUTLOOK_UNAUTHORIZED_TENANT =
  'Usuario fuera del tenant autorizado';
export const OUTLOOK_MAILBOX_FORBIDDEN =
  'El buzón no está en el grupo autorizado de la política de aplicación';
const AUTHORIZED_DOMAIN = 'grupoverytel.com';
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 1_000;
const MAX_PAUSE_MS = 60 * 60 * 1000;
const ERROR_MAX_LENGTH = 500;

/** Graph rejects reminderMinutesBeforeStart above 28 days. */
export const OUTLOOK_REMINDER_MINUTES_CAP = 40320;

export function outlookReminderMinutes(remindDaysBefore: number): number {
  return Math.min(remindDaysBefore * 1440, OUTLOOK_REMINDER_MINUTES_CAP);
}

export type OutlookSyncSettings = {
  enabled: boolean;
  maxAttempts: number;
  intervalMs: number;
  publicUrl: string | null;
};

type ConfigSource = {
  get(key: string): unknown;
};

export const OUTLOOK_CANDIDATE_SQL = `
SELECT reminder_id
FROM reminders
WHERE deleted_at IS NULL
  AND ouv_interaction_id IS NOT NULL
  AND completed_at IS NULL
  AND outlook_sync_status IN ('PENDING', 'FAILED')
  AND outlook_sync_attempts < :maxAttempts
ORDER BY updated_at ASC
LIMIT ${OUTLOOK_SYNC_BATCH_LIMIT}
`;

export const OUTLOOK_LOCK_SQL = `
SELECT reminder_id
FROM reminders
WHERE reminder_id = :reminderId
  AND deleted_at IS NULL
  AND ouv_interaction_id IS NOT NULL
  AND outlook_sync_status IN ('PENDING', 'FAILED')
  AND outlook_sync_attempts < :maxAttempts
FOR UPDATE SKIP LOCKED
`;

export const OUTLOOK_CONTEXT_SQL = `
SELECT
  u.email AS email,
  oi.titulo AS titulo,
  oi.ouv_id AS ouv_id,
  o.consecutivo AS consecutivo
FROM reminders r
INNER JOIN users u ON u.user_id = r.user_id
INNER JOIN ouv_interactions oi ON oi.ouv_interaction_id = r.ouv_interaction_id
INNER JOIN ouvs o ON o.ouv_id = oi.ouv_id
WHERE r.reminder_id = :reminderId
LIMIT 1
`;

export function readOutlookSyncConfig(
  source: ConfigSource,
): OutlookSyncSettings {
  const enabled = readFlag(source.get('OUTLOOK_SYNC_ENABLED'));
  const maxAttempts = readInteger(
    source.get('OUTLOOK_SYNC_MAX_ATTEMPTS'),
    'OUTLOOK_SYNC_MAX_ATTEMPTS',
    DEFAULT_MAX_ATTEMPTS,
    1,
  );
  const intervalMs = readInteger(
    source.get('OUTLOOK_SYNC_INTERVAL_MS'),
    'OUTLOOK_SYNC_INTERVAL_MS',
    DEFAULT_INTERVAL_MS,
    MIN_INTERVAL_MS,
  );
  const publicUrl = readPublicUrl(source.get('CRM_PUBLIC_URL'), enabled);
  return { enabled, maxAttempts, intervalMs, publicUrl };
}

export function isAuthorizedMailbox(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 1) {
    return false;
  }
  return normalized.slice(at + 1) === AUTHORIZED_DOMAIN;
}

export type OutlookEventInput = {
  reminderId: string;
  consecutivo: string;
  titulo: string;
  note: string | null;
  eventAt: Date;
  remindDaysBefore: number;
  ouvId: string;
  publicUrl: string;
};

export function buildOutlookEvent(
  input: OutlookEventInput,
): Record<string, unknown> {
  const end = new Date(input.eventAt.getTime() + 30 * 60 * 1000);
  const url = `${input.publicUrl.replace(/\/+$/, '')}/opportunities/${input.ouvId}?tab=recordatorios`;
  const note = input.note?.trim();
  const noteHtml = note ? `<p>${escapeHtml(note)}</p>` : '';
  const subject = `Recordatorio CRM: ${input.consecutivo} — ${input.titulo}`;
  return {
    subject: subject.length <= 255 ? subject : subject.slice(0, 255),
    body: {
      contentType: 'HTML',
      content: `${noteHtml}<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
    },
    start: { dateTime: graphUtc(input.eventAt), timeZone: 'UTC' },
    end: { dateTime: graphUtc(end), timeZone: 'UTC' },
    isReminderOn: true,
    reminderMinutesBeforeStart: outlookReminderMinutes(input.remindDaysBefore),
    showAs: 'free',
    transactionId: input.reminderId,
  };
}

export type GraphFailure = {
  status: number;
  message: string;
  retryAfter?: string;
};

export function describeGraphFailure(error: unknown): GraphFailure {
  if (error instanceof HttpException) {
    const status = error.getStatus();
    const response = error.getResponse();
    if (typeof response === 'string') {
      return { status, message: response };
    }
    if (response && typeof response === 'object') {
      const body = response as { message?: unknown; retryAfter?: unknown };
      const raw = body.message;
      const message = Array.isArray(raw)
        ? raw.map(String).join(', ')
        : typeof raw === 'string'
          ? raw
          : error.message;
      const retryAfter =
        typeof body.retryAfter === 'string' && body.retryAfter.trim()
          ? body.retryAfter.trim()
          : undefined;
      return { status, message, retryAfter };
    }
  }
  const message = error instanceof Error ? error.message : 'Error de red';
  return { status: 503, message };
}

export function retryAfterDelayMs(
  header: string | undefined,
  now = Date.now(),
): number {
  if (!header) {
    return 0;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_PAUSE_MS);
  }
  const when = Date.parse(header);
  if (Number.isNaN(when)) {
    return 0;
  }
  return Math.min(Math.max(0, when - now), MAX_PAUSE_MS);
}

export function truncateOutlookError(message: string): string {
  return message.length <= ERROR_MAX_LENGTH
    ? message
    : message.slice(0, ERROR_MAX_LENGTH);
}

function readFlag(value: unknown): boolean {
  if (value == null || value === '') {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    throw new Error('OUTLOOK_SYNC_ENABLED must be true or false');
  }
  const text = value.trim().toLowerCase();
  if (text === 'true') {
    return true;
  }
  if (text === 'false') {
    return false;
  }
  throw new Error('OUTLOOK_SYNC_ENABLED must be true or false');
}

function readInteger(
  value: unknown,
  name: string,
  fallback: number,
  minimum: number,
): number {
  if (value == null || value === '') {
    return fallback;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${name} must be an integer >= ${minimum}`);
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`);
  }
  return parsed;
}

function readPublicUrl(value: unknown, required: boolean): string | null {
  if (value != null && typeof value !== 'string') {
    throw new Error('CRM_PUBLIC_URL must be an http(s) URL');
  }
  const text = value == null ? '' : value.trim();
  if (!text) {
    if (required) {
      throw new Error(
        'CRM_PUBLIC_URL must be an http(s) URL when OUTLOOK_SYNC_ENABLED is true',
      );
    }
    return null;
  }
  if (!/^https?:\/\/\S+$/i.test(text)) {
    throw new Error('CRM_PUBLIC_URL must be an http(s) URL');
  }
  return text;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function graphUtc(date: Date): string {
  return date.toISOString().slice(0, 19);
}
