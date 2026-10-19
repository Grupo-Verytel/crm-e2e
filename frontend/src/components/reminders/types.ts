export type ReminderGroup = 'OVERDUE' | 'TODAY' | 'UPCOMING';

export type ReminderSourceType = 'LEAD' | 'SQL' | 'OUV';

/** Item of GET /api/v1/reminders. */
export type BellReminderItem = {
  reminder_id: string;
  event_at: string;
  remind_at: string;
  note: string | null;
  status: string;
  group: ReminderGroup;
  source_type: ReminderSourceType;
  source_id: string;
  source_label: string;
  interaction_title: string;
};

/** `counts` of GET /api/v1/reminders. The page does not recompute them. */
export type RemindersCounts = Record<ReminderGroup, number>;

/** Fields the tray renders. Bell and OUV detail both map into this shape. */
export type ReminderTrayItem = {
  reminder_id: string;
  event_at: string;
  note: string | null;
  status: string;
  completed_at: string | null;
  source_label: string;
  user_id?: string;
  responsable_nombre?: string | null;
};
