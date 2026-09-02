import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  OuvSegmento,
  OuvVertical,
} from '../models/enums/ouv.enums';

/** Body for PATCH /discovery/ouvs/:id — header metadata only. */
export class ActualizarOuvDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  empresa_nombre?: string;

  @IsOptional()
  @IsEnum(OuvSegmento)
  segmento?: OuvSegmento;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @IsIn(Object.values(OuvVertical))
  vertical?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
