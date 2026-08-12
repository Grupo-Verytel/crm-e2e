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

/** Body for SQL→OUV conversion (qualification EARS-11 / 15–17). */
export class CrearOuvDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  /** Legacy ENUM — kept during coexistence with segments table. */
  @IsEnum(OuvSegmento)
  segmento!: OuvSegmento;

  /** Primary segment selector (EARS-11 / EARS-15). */
  @IsUUID('4')
  segment_id!: string;

  /** Optional; must belong to segment_id (EARS-16 / EARS-17). */
  @IsOptional()
  @IsUUID('4')
  subsegment_id?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @IsIn(Object.values(OuvVertical))
  vertical!: string;
}
