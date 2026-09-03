import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ProcessingStatus } from '../domain/enums';

/**
 * §6.4 — body de `POST .../processing-receipts`.
 *
 * `reason_code` obligatorio no nulo cuando `processing_status` es
 * QUARANTINED o REJECTED; la regla vive en el validador semántico para poder
 * emitir 422 MISSING_REASON_CODE con puntero, no un 400 genérico.
 *
 * `semantic_fingerprint` es **opaco** para el CRM: se persiste como dato
 * técnico del acuse y no se expone como campo comercial (INV-25).
 */
export class CreateProcessingReceiptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  receipt_id!: string;

  @IsInt()
  @Min(1)
  receipt_version!: number;

  @IsEnum(ProcessingStatus)
  processing_status!: ProcessingStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  correlation_id!: string;

  @IsDateString()
  observed_at!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  adapter_version!: string;

  /** Nullable, pero la clave debe venir presente (§6.4). */
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(64)
  reason_code!: string | null;

  @Matches(/^[0-9a-f]{64}$/)
  semantic_fingerprint!: string;
}
