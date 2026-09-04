import { CreateProcessingReceiptDto } from './dtos/create-processing-receipt.dto';
import { GetResponseQueryDto } from './dtos/get-response-query.dto';
import { ListInteractionsQueryDto } from './dtos/list-interactions-query.dto';
import { PublishResponseDto } from './dtos/publish-response.dto';

/**
 * DTOs de nivel superior del contrato CRM ↔ MEP-LEAN.
 *
 * El `ValidationPipe` global del CRM corre **antes** que los pipes de
 * parámetro y rechazaría una propiedad no declarada con `400 BadRequest`,
 * adelantándose al `422 UNKNOWN_PROPERTY` que exige §7.4. Por eso el pipe
 * global salta estos tipos: los valida `createMepValidationPipe()`, que sí
 * traduce al catálogo de errores del contrato.
 *
 * Solo hacen falta los metatipos de nivel superior: los anidados
 * (`ServiceResultDto`, `RouteCapacityDto`, …) los valida `class-validator`
 * dentro del mismo pipe, no el pipe global.
 *
 * Agregar un DTO de entrada al contrato exige agregarlo aquí.
 */
export const MEP_CONTRACT_DTOS: readonly unknown[] = [
  ListInteractionsQueryDto,
  GetResponseQueryDto,
  CreateProcessingReceiptDto,
  PublishResponseDto,
];

export function isMepContractDto(metatype: unknown): boolean {
  return MEP_CONTRACT_DTOS.includes(metatype);
}
