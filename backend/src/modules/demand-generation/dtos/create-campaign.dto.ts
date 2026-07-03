import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CampaignObjetivo, CampaignTipo } from '../models/enums/campaign.enums';
import { SegmentoObjetivo } from '../models/enums/segment.enum';
import { IsDateAfter, IsNotPastDate } from './validators/date.validators';

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre: string;

  @IsEnum(CampaignTipo)
  tipo: CampaignTipo;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  canal: string;

  @IsEnum(CampaignObjetivo)
  objetivo: CampaignObjetivo;

  @IsEnum(SegmentoObjetivo)
  segmento_objetivo: SegmentoObjetivo;

  @IsUUID('4')
  responsable_id: string;

  @IsNotEmpty()
  @IsNotPastDate()
  fecha_inicio: string;

  @IsNotEmpty()
  @IsDateAfter('fecha_inicio')
  fecha_fin: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  presupuesto?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gasto_real?: number;
}
