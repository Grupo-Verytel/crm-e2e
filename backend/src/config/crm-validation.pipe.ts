import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { isMepContractDto } from '../modules/mep-integration/mep-contract-dtos';

/**
 * `ValidationPipe` global del CRM.
 *
 * Mantiene el contrato de validación del proyecto (`transform`, `whitelist`,
 * `forbidNonWhitelisted`) para todos los módulos, con una sola excepción: los
 * DTOs de entrada de la integración CRM ↔ MEP-LEAN.
 *
 * Motivo: los pipes globales corren antes que los de parámetro, y este
 * rechazaría una propiedad no declarada con `400 BadRequest` — pero
 * SPEC-CRM-MEPLEAN-001 §7.4 exige `422 UNKNOWN_PROPERTY` para ese caso. Esos
 * DTOs los valida `createMepValidationPipe()` en el propio controlador, con las
 * mismas opciones de `class-validator` y el catálogo de errores del contrato.
 */
export class CrmValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  }

  async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    if (isMepContractDto(metadata.metatype)) {
      return value;
    }

    return super.transform(value, metadata);
  }
}
