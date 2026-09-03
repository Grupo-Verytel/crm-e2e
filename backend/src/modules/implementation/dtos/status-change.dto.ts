import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Payload pushed by the PMO on every project state change. */
export class StatusChangeDto {
  /** OUV_ID — correlation key shared with the PMO. */
  @IsUUID('4')
  referenceId!: string;

  /** PMO state name, free text — not validated against a CRM vocabulary. */
  @IsString()
  @MaxLength(120)
  newStatus!: string;

  @IsISO8601()
  occurredAt!: string;

  /**
   * Any UUID version: the PMO derives this id deterministically from its
   * PSH_NCODE (UUID v5), so a retry carries the same id and this webhook can
   * discard it as a replay. Pinning v4 here would reject every real push.
   */
  @IsUUID()
  externalEventId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  comment?: string;
}

export class StatusChangeAckDto {
  projectStatusEventId!: string;
  externalEventId!: string;
  /** true when the event had already been ingested (idempotent replay). */
  duplicate!: boolean;
}
