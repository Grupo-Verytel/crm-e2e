import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ActorRefDto, AssignmentDto } from './common.dto';
import {
  BusinessMilestone,
  CapacityStatus,
  ResponseStatus,
  RouteStatus,
  ServiceDependency,
  ServiceName,
  ServiceOutcome,
  ServiceResultStatus,
} from '../domain/enums';

const HTTPS_URL = { protocols: ['https'], require_protocol: true };

/** Entregable — §6.5. Debe ser SharePoint Documents (INV-23). */
export class DeliverableDto {
  @IsUrl(HTTPS_URL)
  @MaxLength(1024)
  url!: string;

  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @MaxLength(256)
  label?: string | null;

  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsDateString()
  published_at?: string | null;
}

/** Elemento de `service_results[]` — fuente de verdad del contrato (§6.5). */
export class ServiceResultDto {
  @IsEnum(ServiceName)
  service!: ServiceName;

  @IsEnum(ServiceResultStatus)
  status!: ServiceResultStatus;

  /** `null` mientras `status` no sea COMPLETED (regla semántica, 422). */
  @ValidateIf((_o, value) => value !== null)
  @IsEnum(ServiceOutcome)
  outcome!: ServiceOutcome | null;

  @IsEnum(ServiceDependency)
  dependency!: ServiceDependency;

  @ValidateIf((_o, value) => value !== null)
  @IsString()
  summary!: string | null;

  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @MaxLength(64)
  reason_code!: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliverableDto)
  deliverables!: DeliverableDto[];
}

/** `route_capacity` — reloj de negocio independiente (§7.2, INV-17). */
export class RouteCapacityDto {
  /** `V1`, `V2`, … — patrón del spec. */
  @Matches(/^V[1-9]\d*$/)
  version!: string;

  @IsEnum(RouteStatus)
  route_status!: RouteStatus;

  @IsEnum(CapacityStatus)
  capacity_status!: CapacityStatus;

  @ValidateIf((_o, value) => value !== null)
  @IsString()
  summary!: string | null;

  @IsDateString()
  registered_at!: string;

  @ValidateNested()
  @Type(() => ActorRefDto)
  registered_by!: ActorRefDto;
}

/** `operational_links` — enlaces operativos, HTTPS obligatorio (§6.5). */
export class OperationalLinksDto {
  @IsOptional()
  @IsUrl(HTTPS_URL)
  @MaxLength(1024)
  planner_interaction_url?: string;

  @IsOptional()
  @IsUrl(HTTPS_URL)
  @MaxLength(1024)
  route_capacity_register_url?: string;
}

/**
 * §6.5 — body de `PUT .../responses/{response_id}`.
 *
 * Toda propiedad no declarada aquí se rechaza con 422 UNKNOWN_PROPERTY
 * (`additionalProperties: false` + lista negra de §7.4).
 * P-03 / INV-20: `delivered_interaction_type` es `null` obligatorio antes del
 * cierre; la regla se aplica en el validador semántico.
 */
export class PublishResponseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  response_id!: string;

  @IsInt()
  @Min(1)
  response_version!: number;

  @IsEnum(BusinessMilestone)
  business_milestone!: BusinessMilestone;

  @IsEnum(ResponseStatus)
  response_status!: ResponseStatus;

  /** ETA global único por interacción; `YYYY-MM-DD`. */
  @ValidateIf((_o, value) => value !== null && value !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  eta_date?: string | null;

  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @MaxLength(512)
  next_milestone?: string | null;

  @IsDateString()
  responded_at!: string;

  @ValidateNested()
  @Type(() => ActorRefDto)
  responded_by!: ActorRefDto;

  @ValidateIf((_o, value) => value !== null && value !== undefined)
  @ValidateNested()
  @Type(() => AssignmentDto)
  assignment?: AssignmentDto | null;

  @ValidateIf((_o, value) => value !== null && value !== undefined)
  @ValidateNested()
  @Type(() => RouteCapacityDto)
  route_capacity?: RouteCapacityDto | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ServiceResultDto)
  service_results!: ServiceResultDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OperationalLinksDto)
  operational_links?: OperationalLinksDto;

  /** P-08: solo el texto de esta `response_version`, nunca la acumulada. */
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  narrative_note!: string | null;

  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @MaxLength(128)
  delivered_interaction_type!: string | null;

  @Matches(/^[0-9a-f]{64}$/)
  semantic_fingerprint!: string;
}
