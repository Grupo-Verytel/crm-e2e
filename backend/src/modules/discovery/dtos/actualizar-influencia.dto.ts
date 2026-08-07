import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { InfluenciaEstado } from '../models/enums/ouv.enums';

export class ActualizarInfluenciaDto {
  @IsEnum(InfluenciaEstado)
  estado!: InfluenciaEstado;

  @IsOptional()
  @IsUUID('4')
  contacto_ouv_id?: string | null;

  @IsOptional()
  @IsString()
  motivo_estado?: string | null;

  @IsOptional()
  @IsString()
  notas?: string | null;
}
