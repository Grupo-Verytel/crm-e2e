import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DiscardLeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  motivo: string;
}
