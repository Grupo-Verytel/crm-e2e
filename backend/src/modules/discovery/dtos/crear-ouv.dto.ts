import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  OuvSegmento,
  VERTICALES_PROVISIONALES,
} from '../models/enums/ouv.enums';

export class CrearOuvDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsEnum(OuvSegmento)
  segmento!: OuvSegmento;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @IsIn([...VERTICALES_PROVISIONALES])
  vertical!: string;
}
