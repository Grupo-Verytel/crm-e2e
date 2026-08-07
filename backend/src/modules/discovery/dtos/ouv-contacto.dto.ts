import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CrearOuvContactoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cargo?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class ActualizarOuvContactoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cargo?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string | null;

  @IsOptional()
  @IsString()
  notas?: string | null;
}
