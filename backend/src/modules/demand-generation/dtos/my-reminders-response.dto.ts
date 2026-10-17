import type { ReminderGroup } from '../lib/reminder-group';

export type ReminderSourceType = 'LEAD' | 'SQL' | 'OUV';

export class MyReminderItemDto {
  reminder_id!: string;
  event_at!: Date;
  remind_at!: Date;
  note!: string | null;
  status!: string;
  group!: ReminderGroup;
  source_type!: ReminderSourceType;
  source_id!: string;
  source_label!: string;
  interaction_title!: string;
}

export class MyReminderCountsDto {
  OVERDUE!: number;
  TODAY!: number;
  UPCOMING!: number;
}

export class PaginatedMyRemindersDto {
  items!: MyReminderItemDto[];
  total!: number;
  page!: number;
  limit!: number;
  counts!: MyReminderCountsDto;
}
