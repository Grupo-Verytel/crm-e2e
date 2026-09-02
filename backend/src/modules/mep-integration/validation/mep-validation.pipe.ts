import { ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ProblemErrorItem } from '../constants/error-catalog';
import { MepProblemException } from '../domain/mep-problem.exception';

/**
 * Pipe de validación del contrato — §10.3 + §7.4.
 *
 * Reutiliza `class-validator` con `whitelist: true` y
 * `forbidNonWhitelisted: true` (obligatorio por Artículo VI.3 de la
 * constitución y por §10.3), pero traduce el resultado al catálogo de errores
 * del contrato en vez del `400 BadRequest` genérico de Nest:
 *
 *  - propiedad no declarada        → 422 UNKNOWN_PROPERTY   (§7.4, INV-24/25)
 *  - valor fuera de un enum cerrado→ 422 UNKNOWN_ENUM_VALUE (§3.1, OPEN-01)
 *  - resto (tipos, formatos, …)    → 400 MALFORMED_REQUEST  (ERR-400)
 *
 * En los query params de lectura (§6.1) el enum desconocido también es 400,
 * porque ahí es un defecto de la petición y no de semántica de negocio: se
 * selecciona con `enumStatus`.
 */
export interface MepValidationOptions {
  /** Código HTTP para un valor de enum desconocido. Body: 422; query: 400. */
  enumStatus?: 400 | 422;
}

export function createMepValidationPipe(
  options: MepValidationOptions = {},
): ValidationPipe {
  const enumStatus = options.enumStatus ?? 422;

  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    stopAtFirstError: false,
    validateCustomDecorators: true,
    exceptionFactory: (errors: ValidationError[]) =>
      toProblem(errors, enumStatus),
  });
}

function toProblem(
  errors: ValidationError[],
  enumStatus: 400 | 422,
): MepProblemException {
  const flattened = flatten(errors, '');

  const unknownProperty = flattened.filter(
    (item) => item.kind === 'unknownProperty',
  );
  if (unknownProperty.length > 0) {
    return MepProblemException.unprocessable(
      'UNKNOWN_PROPERTY',
      'El payload contiene propiedades no declaradas en el contrato.',
      unknownProperty.map(toProblemErrorItem),
    );
  }

  const unknownEnum = flattened.filter((item) => item.kind === 'enum');
  if (unknownEnum.length > 0 && flattened.length === unknownEnum.length) {
    const items = unknownEnum.map(toProblemErrorItem);
    return enumStatus === 422
      ? MepProblemException.unprocessable(
          'UNKNOWN_ENUM_VALUE',
          'El payload contiene un valor fuera de la enumeración canónica.',
          items,
        )
      : MepProblemException.badRequest(
          'UNKNOWN_ENUM_VALUE',
          'Valor fuera de la enumeración canónica.',
          items,
        );
  }

  return MepProblemException.badRequest(
    'MALFORMED_REQUEST',
    'La solicitud no cumple el esquema del contrato.',
    flattened.map(toProblemErrorItem),
  );
}

interface FlatError {
  pointer: string;
  kind: 'unknownProperty' | 'enum' | 'other';
  constraint: string;
}

function flatten(
  errors: ValidationError[],
  parentPointer: string,
): FlatError[] {
  const out: FlatError[] = [];

  for (const error of errors) {
    const pointer = `${parentPointer}/${escapePointerToken(error.property)}`;
    const constraints = Object.keys(error.constraints ?? {});

    for (const constraint of constraints) {
      out.push({
        pointer,
        kind:
          constraint === 'whitelistValidation'
            ? 'unknownProperty'
            : constraint === 'isEnum'
              ? 'enum'
              : 'other',
        constraint,
      });
    }

    if (error.children && error.children.length > 0) {
      out.push(...flatten(error.children, pointer));
    }
  }

  return out;
}

function toProblemErrorItem(error: FlatError): ProblemErrorItem {
  return {
    pointer: error.pointer,
    code:
      error.kind === 'unknownProperty'
        ? 'UNKNOWN_PROPERTY'
        : error.kind === 'enum'
          ? 'UNKNOWN_ENUM_VALUE'
          : 'MALFORMED_REQUEST',
  };
}

/** RFC 6901. */
function escapePointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}
