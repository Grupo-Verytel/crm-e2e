import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class NotificationsQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class NotificationResponseDto {
  notification_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  titulo: string;
  mensaje: string;
  actor_user_id: string | null;
  metadata: Record<string, unknown> | null;
  read_at: Date | null;
  created_at: Date;
}

export class PaginatedNotificationsResponseDto {
  items: NotificationResponseDto[];
  total: number;
  page: number;
  limit: number;
}
