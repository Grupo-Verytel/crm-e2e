import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  OuvSegmento,
  OuvVertical,
  VERTICALES_PROVISIONALES,
} from '../models/enums/ouv.enums';

/**
 * Body para PATCH /discovery/ouvs/:id.
 *
 * Cubre los metadatos de cabecera y las relaciones estructurales editables
 * (account, segment/subsegment, comercial). Los campos con flujo dedicado
 * (zona_actual, resultado, motivos, presupuesto_*) NO viajan por aquí —
 * tienen sus propios endpoints con guardas y auditoría distintas.
 */
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
  @IsIn(VERTICALES_PROVISIONALES)
  vertical?: OuvVertical;

  @IsOptional()
  @IsString()
  descripcion?: string;

  /** null desliga la account del OUV. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  account_id?: string | null;

  /** null desliga el segmento estructurado. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  segment_id?: string | null;

  /** null desliga el subsegmento (mantiene el segmento). */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  subsegment_id?: string | null;

  /**
   * Reasignar el comercial dueño de la OUV. Solo Admin puede enviar este
   * campo; el service rechaza el intento si el actor no es Admin.
   */
  @IsOptional()
  @IsUUID()
  comercial_id?: string;
}
