import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class LeadContactInputDto {
  @IsUUID('4')
  person_id: string;
}

export class DirectChecklistDto {
  @IsBoolean()
  criterio_sector_objetivo: boolean;

  @IsBoolean()
  criterio_necesidad_portafolio: boolean;

  @IsBoolean()
  criterio_acceso_decisor: boolean;

  @IsBoolean()
  criterio_presupuesto_indicios: boolean;
}

export class LeadContactResponseDto {
  contact_id: string;
  position: number;
  person_id: string;
  name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  account_id: string;
  account_name: string;
  account_tax_id: string | null;
}
