import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Los DTOs de esta integración usan nombres en **snake_case** porque son el
 * contrato externo literal (§4–§6). No se renombran a camelCase: cualquier
 * variación de nombre es una violación de P-12 (contract-first).
 */

/** `{ ref, display_name }` — actor humano o de servicio de MEP. */
export class ActorRefDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  ref!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  display_name!: string;
}

/** `assignment` — ingeniero de preventa asignado (§6.5). */
export class AssignmentDto {
  @ValidateNested()
  @Type(() => ActorRefDto)
  engineer!: ActorRefDto;

  @IsDateString()
  assigned_at!: string;
}
