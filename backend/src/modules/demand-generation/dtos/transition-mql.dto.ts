import { IsOptional, IsUUID } from 'class-validator';

export class TransitionToMqlDto {
  /** When omitted the lead's most recent checklist is used. */
  @IsOptional()
  @IsUUID('4')
  checklist_id?: string;
}
