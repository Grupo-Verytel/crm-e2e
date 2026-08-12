import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Declared before InlineOuvPersonDto to avoid TDZ with emitDecoratorMetadata. */
export class InlineOuvAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tax_id?: string | null;
}

export class InlineOuvPersonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  job_title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @ValidateIf((o: InlineOuvPersonDto) => !o.account)
  @IsUUID('4')
  account_id?: string;

  @ValidateIf((o: InlineOuvPersonDto) => !o.account_id)
  @ValidateNested()
  @Type(() => InlineOuvAccountDto)
  account?: InlineOuvAccountDto;
}

/** Create: person_id XOR inline person (+ optional notas). */
export class CrearOuvContactoDto {
  @ValidateIf((o: CrearOuvContactoDto) => !o.person)
  @IsUUID('4')
  person_id?: string;

  @ValidateIf((o: CrearOuvContactoDto) => !o.person_id)
  @ValidateNested()
  @Type(() => InlineOuvPersonDto)
  person?: InlineOuvPersonDto;

  @IsOptional()
  @IsString()
  notas?: string;
}

/** EARS-09 — only notas are editable on the OUV contact row. */
export class ActualizarOuvContactoDto {
  @IsOptional()
  @IsString()
  notas?: string | null;
}
