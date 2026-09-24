import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class EditarNotaInfluenciaDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  notas?: string | null;
}
