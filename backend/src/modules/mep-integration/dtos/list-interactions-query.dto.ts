import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ServiceHorizon } from '../domain/enums';

/**
 * §6.1 — query params de `GET /v1/commercial-interactions`.
 *
 * `limit` fuera de 1..200 y enum desconocido → 400 (no 422): son errores de
 * la petición, no de semántica de negocio.
 */
export class ListInteractionsQueryDto {
  /** Cursor opaco firmado; retención 7 días. */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }): number | string | undefined => {
    const raw: unknown = value;
    if (raw === undefined || raw === null || raw === '') {
      return undefined;
    }
    const parsed = Number(raw);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
    // Un valor no entero se devuelve tal cual (como texto) para que `@IsInt()`
    // lo rechace con 400, en vez de colapsar a NaN o al default en silencio.
    return typeof raw === 'string' ? raw : JSON.stringify(raw);
  })
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsEnum(ServiceHorizon)
  service_horizon?: ServiceHorizon;
}

/** Tamaño de página por defecto (§6.1). */
export const DEFAULT_INTAKE_LIMIT = 50;
export const MAX_INTAKE_LIMIT = 200;
