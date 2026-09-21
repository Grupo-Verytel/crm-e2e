import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { InfluenciaEstado } from '../models/enums/ouv.enums';

export class ActualizarInfluenciaDto {
  @IsEnum(InfluenciaEstado)
  estado!: InfluenciaEstado;

  /**
   * Any UUID version: pre-production loads generate deterministic UUID v5
   * for `ouv_contactos`. Pinning v4 here rejects assign/evaluate on those rows.
   * Empty string (select "Sin asignar") is treated as null.
   */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  contacto_ouv_id?: string | null;

  @IsOptional()
  @IsString()
  motivo_estado?: string | null;

  @IsOptional()
  @IsString()
  notas?: string | null;
}
