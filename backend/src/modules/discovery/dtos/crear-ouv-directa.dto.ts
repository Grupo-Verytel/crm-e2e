import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  OuvSegmento,
  OuvVertical,
} from '../models/enums/ouv.enums';

/** Body for POST /discovery/ouvs (Vías 2/3/4). */
export class CrearOuvDirectaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  empresa_nombre!: string;

  @IsEnum(OuvSegmento)
  segmento!: OuvSegmento;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @IsIn(Object.values(OuvVertical))
  vertical!: string;

  @IsString()
  @IsNotEmpty()
  descripcion!: string;

  @IsOptional()
  @IsUUID('4')
  account_id?: string;

  @IsOptional()
  @IsUUID('4')
  segment_id?: string;

  @IsOptional()
  @IsUUID('4')
  subsegment_id?: string;
}
