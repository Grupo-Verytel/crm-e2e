export class ReminderResponseDto {
  reminder_id: string;
  interaction_id: string | null;
  event_at: Date;
  remind_days_before: number;
  remind_at: Date;
  note: string | null;
  status: string;
}

/** Body of PATCH complete / cancel. Both sources share this shape. */
export class ReminderActionResponseDto {
  reminder_id: string;
  interaction_id: string | null;
  ouv_interaction_id: string | null;
  user_id: string;
  event_at: Date;
  remind_days_before: number;
  remind_at: Date;
  note: string | null;
  status: string;
  completed_at: Date | null;
  outlook_sync_status: string;
  outlook_event_id: string | null;
}
