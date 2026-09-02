import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ActivityPriority, ServiceCombo } from '../presales-vocabulary';

/**
 * Cuerpo de `POST /api/v1/discovery/ouvs/:id/solicitudes-preventa`.
 *
 * La UI envía **solo decisiones de negocio**. Todo lo que es autoridad del CRM
 * —`crm_interaction_ref`, `crm_opportunity_ref`, `source_created_at`,
 * `source_version`, `etag`— lo genera el servidor (§4, P-01). El diseño de
 * referencia los pintaba como campos del formulario y derivaba la referencia
 * con un `mockInteractionRef()` en el browser; eso rompería la identidad de
 * correlación del contrato, así que aquí no se aceptan.
 */
export class CreatePresalesRequestDto {
  /** Prioridad comercial; determina el `service_horizon` del contrato. */
  @IsEnum(ActivityPriority)
  priority!: ActivityPriority;

  /** Uno de los 4 casos válidos de `requested_services[]` (§7.6). */
  @IsEnum(ServiceCombo)
  service_combo!: ServiceCombo;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  subject?: string;

  /**
   * Nota original del usuario comercial. El CRM la preserva sin alteración
   * (P-07 / INV-07): no se hace trim, ni normalización, ni sanitización
   * destructiva en ningún punto del camino.
   */
  @IsString()
  @MinLength(1)
  source_content!: string;
}
