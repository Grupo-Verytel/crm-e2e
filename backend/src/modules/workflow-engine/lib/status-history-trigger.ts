/** Values stored in status_history.trigger (VARCHAR 32). */
export const StatusHistoryTrigger = {
  Create: 'CREATE',
  Advance: 'ADVANCE',
  Retreat: 'RETREAT',
  Approval: 'APPROVAL',
  Rejection: 'REJECTION',
  Assignment: 'ASSIGNMENT',
  Conversion: 'CONVERSION',
  Recycle: 'RECYCLE',
  Win: 'WIN',
  Loss: 'LOSS',
  Discard: 'DISCARD',
  Manual: 'MANUAL',
} as const;

export type StatusHistoryTriggerValue =
  (typeof StatusHistoryTrigger)[keyof typeof StatusHistoryTrigger];

const TRIGGER_BY_EVENT: Record<string, StatusHistoryTriggerValue> = {
  'lead.mql_aprobado': StatusHistoryTrigger.Approval,
  'sql.creado': StatusHistoryTrigger.Create,
  'sql.creado_directo': StatusHistoryTrigger.Create,
  'sql.asignado': StatusHistoryTrigger.Assignment,
  'sql.convertido_ouv': StatusHistoryTrigger.Conversion,
  'sql.descartado': StatusHistoryTrigger.Discard,
  'ouv.creada_desde_sql': StatusHistoryTrigger.Create,
  'ouv.creada_directa': StatusHistoryTrigger.Create,
  'ouv.avance_zona': StatusHistoryTrigger.Advance,
  'ouv.retroceso_zona': StatusHistoryTrigger.Retreat,
  'ouv.ganada': StatusHistoryTrigger.Win,
  'ouv.perdida': StatusHistoryTrigger.Loss,
  'ouv.descartada': StatusHistoryTrigger.Discard,
};

export function triggerFromEventType(eventType: string): StatusHistoryTriggerValue {
  return TRIGGER_BY_EVENT[eventType] ?? StatusHistoryTrigger.Manual;
}

export function payloadString(
  payload: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
