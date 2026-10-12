export type OuvReminderResolution = 'done' | 'dismissed';

export type ReminderEntityKind = 'OUV' | 'Lead';

export type OuvReminder = {
  reminder_id: string;
  ouv_id: string;
  ouv_consecutivo: string;
  ouv_titulo: string;
  interaccion_id: string;
  interaccion_titulo: string;
  remind_at: string;
  created_at: string;
  /** @deprecated Prefer `resolution`. Kept for records already stored. */
  dismissed_at: string | null;
  resolution?: OuvReminderResolution | null;
  resolved_at?: string | null;
  /** Missing on older OUV records stored before this field existed. */
  entity_kind?: ReminderEntityKind;
};

export function reminderEntityKind(item: OuvReminder): ReminderEntityKind {
  return item.entity_kind === 'Lead' ? 'Lead' : 'OUV';
}

export const OUV_REMINDERS_CHANGED_EVENT = 'crm-ouv-reminders-changed';
