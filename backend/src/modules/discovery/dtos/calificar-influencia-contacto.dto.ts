import { IsEnum } from 'class-validator';
import { InfluenciaEstado } from '../models/enums/ouv.enums';

export class CalificarInfluenciaContactoDto {
  @IsEnum(InfluenciaEstado)
  estado!: InfluenciaEstado;
}
