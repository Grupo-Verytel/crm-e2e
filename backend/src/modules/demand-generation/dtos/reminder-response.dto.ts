export class ReminderResponseDto {
  reminder_id: string;
  interaction_id: string | null;
  event_at: Date;
  remind_days_before: number;
  remind_at: Date;
  note: string | null;
  status: string;
}
