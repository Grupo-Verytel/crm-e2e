import type { FollowUpStatus } from '../lib/follow-up-status';

export class AssignedOuvItemDto {
  ouv_id!: string;
  consecutivo!: string;
  titulo!: string;
  empresa_nombre!: string;
  zona_actual!: string;
  comercial_id!: string;
  comercial_nombre!: string | null;
  next_reminder_at!: Date | null;
  follow_up_status!: FollowUpStatus;
}

export class PaginatedAssignedOuvsDto {
  items!: AssignedOuvItemDto[];
  total!: number;
  page!: number;
  limit!: number;
}
