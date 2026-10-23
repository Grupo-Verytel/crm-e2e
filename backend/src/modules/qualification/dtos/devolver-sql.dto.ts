import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DevolverSqlDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  motivo: string;
}
