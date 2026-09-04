import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * §6.6 — `GET .../responses/{response_id}?version=n`.
 *
 * Sin `version` devuelve la última `response_version`; con `version` devuelve
 * esa versión concreta del histórico inmutable (404 si no existe).
 */
export class GetResponseQueryDto {
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
  version?: number;
}
