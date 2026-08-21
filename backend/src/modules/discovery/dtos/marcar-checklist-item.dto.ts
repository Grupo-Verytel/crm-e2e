import { IsBoolean } from 'class-validator';

export class MarcarChecklistItemDto {
  @IsBoolean()
  marcado!: boolean;
}
