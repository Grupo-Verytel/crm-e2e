---
name: dto-validation-class-validator
description: Convención de DTOs con class-validator/class-transformer para el CRM Frisson — separación Create/Update, decoradores por tipo de campo, exclusión de campos auto-generados (consecutivos, calculados), y forma estándar de errores 400. Úsalo al crear o modificar cualquier DTO de entrada en un controller NestJS.
paths:
  - "backend/src/modules/**/*.dto.ts"
  - "backend/src/modules/**/*.controller.ts"
---

# DTOs con class-validator — CRM Frisson

## Setup global (verificar que ya esté, no repetir por módulo)

```typescript
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,           // descarta campos no declarados en el DTO
    forbidNonWhitelisted: true, // rechaza el request si vienen campos extra (400, no los ignora en silencio)
    transform: true,            // aplica @Type() y castea query params (string → number/boolean)
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

`forbidNonWhitelisted: true` es deliberado: si el frontend manda `consecutivo` en un `UPDATE` por error, el request debe fallar explícitamente con 400, no ignorarlo silenciosamente — así el bug se detecta en desarrollo, no en producción.

## Regla base: Create y Update son clases distintas, nunca la misma con campos opcionales

```typescript
// ❌ MAL — una sola clase con todo opcional pierde la validación de obligatoriedad en creación
export class OuvDto {
  nombre?: string;
  consecutivo?: string; // 🚨 nunca debería poder llegar desde el cliente, ni en create ni en update
}
```

```typescript
// ✅ BIEN — dos clases explícitas
export class CreateOuvDto {
  @ApiProperty({ example: 'Renovación licencia SIEM' })
  @IsString() @IsNotEmpty() @MaxLength(160)
  nombre: string;

  @ApiProperty({ enum: Segmento })
  @IsEnum(Segmento)
  segmento: Segmento;

  @ApiProperty({ enum: TipoVenta })
  @IsEnum(TipoVenta)
  tipo_venta: TipoVenta;

  @ApiProperty({ example: 150000000 })
  @IsNumber() @Min(0)
  valor_estimado: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional() @IsInt() @Min(0) @Max(100)
  prob_cierre?: number;

  @ApiProperty()
  @IsDateString()
  fecha_cierre: string;

  @ApiProperty()
  @IsString() @MaxLength(80)
  region: string;

  @ApiProperty()
  @IsString()
  tipo_solucion: string;

  @ApiPropertyOptional({ enum: EtiquetaMetodologia })
  @IsOptional() @IsEnum(EtiquetaMetodologia)
  etiqueta_metodologia?: EtiquetaMetodologia;

  // NOTA: sql_id se toma del path param o del contexto autenticado, no del body
  // NOTA: consecutivo NO existe en este DTO — lo genera el skill `generar-consecutivo`
}
```

```typescript
export class UpdateOuvDto extends PartialType(
  OmitType(CreateOuvDto, [] as const), // aquí solo se omiten campos que NUNCA cambian tras creación, si los hay
) {
  // Campos que solo tienen sentido en actualización (nunca en creación) van aquí, no en CreateOuvDto
}
```

`PartialType` (de `@nestjs/mapped-types`) vuelve todos los campos opcionales para el update sin reescribirlos — pero **nunca** incluyas ahí `consecutivo`, `created_at`, `created_by`, ni cualquier campo calculado (`pct_avance`, `score_total`) porque `PartialType` los volvería editables por accidente si algún día están en el DTO base. Si un campo es solo-lectura, decláralo en una clase de **respuesta** (`OuvResponseDto`), no en el DTO de creación.

## Mapeo tipo de dato del Blueprint → decorador

| Tipo en Blueprint | Decoradores TypeScript/class-validator |
|---|---|
| `UUID` (FK) | `@IsUUID()` |
| `VARCHAR(n)` | `@IsString() @MaxLength(n)` |
| `ENUM` | `@IsEnum(MiEnum)` — define el enum TS espejo del `ENUM` de MySQL, en `common/enums/` |
| `NUMERIC(p,s)` | `@IsNumber({ maxDecimalPlaces: s }) @Min(0)` (o el rango que aplique, ej. `prob_cierre` 0-100) |
| `BOOLEAN` | `@IsBoolean() @Type(() => Boolean)` (el `@Type` es obligatorio si viene de query params) |
| `DATE` / `TIMESTAMPTZ` | `@IsDateString()` |
| `JSON`/`JSONB` (ej. `requerimientos`, `checklist_metodologia`) | `@IsArray() @ValidateNested({ each: true }) @Type(() => RequerimientoItemDto)` — nunca `@IsObject()` genérico si la estructura es conocida; define el DTO anidado |
| Campo auto-generado (`consecutivo`, `seq_num`, `pct_avance` calculado, `score_total`) | **No existe en el DTO de entrada.** Se calcula en el servicio. |

## Validación anidada (ejemplo: `checklist_metodologia` de OUV)

```typescript
export class ChecklistCriterioDto {
  @IsString() clave: string;
  @IsBoolean() cumplido: boolean;
}

export class UpdateChecklistDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistCriterioDto)
  criterios: ChecklistCriterioDto[];
}
```

Sin `@ValidateNested` + `@Type`, class-validator **no valida el contenido del array**, solo que sea un array — es el error más común y silencioso en DTOs con JSON anidado.

## Forma estándar de error 400 (para que frontend tenga un contrato único)

NestJS por defecto ya devuelve esto con `ValidationPipe`, pero documenta el shape esperado para que el frontend (skill `tabla-filtrable-paginada` y formularios) lo maneje de forma consistente:

```json
{
  "statusCode": 400,
  "message": [
    "valor_estimado must not be less than 0",
    "fecha_cierre must be a valid ISO 8601 date string"
  ],
  "error": "Bad Request"
}
```

Si necesitas errores field-level estructurados (`{ field, message }`) para un formulario complejo, usa un `exceptionFactory` custom en el `ValidationPipe` — no lo resuelvas parseando el string de `message` en el frontend.

## Anti-patrones

- ❌ Un DTO único reutilizado para create/update con todo opcional — pierde la garantía de campos obligatorios en creación.
- ❌ Incluir `consecutivo`, `created_at`, `created_by` o cualquier campo calculado en un DTO de entrada — estos campos vienen del servicio (ver skill `generar-consecutivo`), nunca del cliente.
- ❌ `@IsObject()` o `any` para campos JSON con estructura conocida (`requerimientos`, `checklist_metodologia`, `flujo_caja`) — siempre define el DTO anidado con `@ValidateNested`.
- ❌ Omitir `@Type(() => Boolean)` / `@Type(() => Number)` en query params — sin `transform: true` + `@Type`, todo llega como string y `@IsBoolean()`/`@IsInt()` fallan aunque el valor "se vea" correcto.

## Checklist de testing

- Test que confirme que un `CreateDto` con campo `consecutivo` inyectado manualmente es rechazado por `forbidNonWhitelisted` (400).
- Test de cada ENUM del Blueprint con un valor inválido → 400 con mensaje claro.
- Test de `UpdateDto` parcial (solo 1 campo) que confirme que no exige los campos obligatorios de creación.
