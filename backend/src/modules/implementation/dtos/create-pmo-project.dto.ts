import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export const PMO_PROJECT_TYPES = ['RECURRING', 'NON_RECURRING'] as const;
export type PmoProjectType = (typeof PMO_PROJECT_TYPES)[number];

/**
 * Data the comercial supplies to open the delivery project in the PMO.
 * Everything the CRM already knows about the OUV (name, contract value) is
 * filled in by the service — this DTO only carries what the OUV cannot answer.
 */
export class CreatePmoProjectDto {
  /** Defaults to the OUV's `titulo` when omitted. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nombreProyecto?: string;

  /** Defaults to now when omitted. */
  @IsOptional()
  @IsISO8601()
  fechaAsignacion?: string;

  @IsISO8601()
  fechaInicio!: string;

  @IsISO8601()
  fechaFin!: string;

  @IsOptional()
  @IsIn(PMO_PROJECT_TYPES)
  tipoProyecto?: PmoProjectType;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  sharepointUrl?: string;

  /** Defaults to the OUV's `montoFinal` when omitted. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  valorContrato?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  costosEsperados?: number;
}

/** Payload accepted by the PMO's `POST /api/projects` — its own column names. */
export interface PmoCreateProjectPayload {
  PRO_CNAME: string;
  PRO_DASSIGNMENT: string;
  PRO_DSTART: string;
  PRO_DEND: string;
  OUV_ID: string;
  PRO_CPROJECT_TYPE?: PmoProjectType;
  PRO_CSHAREPOINT_URL?: string;
  N_CONTRACT_VALUE?: number;
  N_EXPECTED_TOTAL_COSTS?: number;
}

export class PmoProjectCreatedDto {
  ouvId!: string;
  /** PRO_NCODE assigned by the PMO. */
  projectId!: number;
}
