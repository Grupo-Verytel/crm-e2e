import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class LeadContactInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  empresa_nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  cargo: string;

  @IsEmail()
  @MaxLength(180)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  telefono: string;
}

export class LeadContactResponseDto {
  contact_id: string;
  position: number;
  empresa_nombre: string;
  nombre: string;
  cargo: string | null;
  email: string;
  telefono: string | null;
}
