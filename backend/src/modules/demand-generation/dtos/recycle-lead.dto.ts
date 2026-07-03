import { IsUUID } from 'class-validator';

export class RecycleLeadDto {
  @IsUUID('4')
  responsable_id: string;
}
