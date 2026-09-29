import { IsISO8601, IsOptional, ValidateIf } from 'class-validator';

/**
 * PATCH body for commercial closure date on a Preventa solicitud.
 * Persisted on `commercial_interaction.interaction_closed_at` and exposed to MEP intake.
 */
export class UpdatePresalesRequestDto {
  /** ISO 8601 date-time; `null` clears the value. */
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsISO8601({ strict: true })
  interaction_closed_at?: string | null;
}
