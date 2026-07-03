import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectMqlDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  motivo: string;
}
