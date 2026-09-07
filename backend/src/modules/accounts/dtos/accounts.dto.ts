import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PersonInfluenciaTipo } from '../models/enums/person-influencia-tipo.enum';

export class AccountsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  tax_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  economic_sector!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string | null;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tax_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  economic_sector?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string | null;
}

export class AccountResponseDto {
  account_id!: string;
  name!: string;
  tax_id!: string | null;
  economic_sector!: string | null;
  address!: string | null;
  website!: string | null;
  created_at!: Date;
  updated_at!: Date;
}

export class PaginatedAccountsResponseDto {
  items!: AccountResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
}

export class PeopleQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  q?: string;

  @IsOptional()
  @IsUUID()
  account_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class CreatePersonDto {
  @IsString()
  @MinLength(1)
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

  @IsUUID()
  account_id!: string;

  @IsOptional()
  @IsEnum(PersonInfluenciaTipo)
  tipo_influencia?: PersonInfluenciaTipo;
}

export class UpdatePersonDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

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

  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsEnum(PersonInfluenciaTipo)
  tipo_influencia?: PersonInfluenciaTipo | null;
}

export class PersonResponseDto {
  person_id!: string;
  name!: string;
  job_title!: string | null;
  email!: string | null;
  phone!: string | null;
  account_id!: string;
  account_name?: string | null;
  tipo_influencia!: PersonInfluenciaTipo | null;
  created_at!: Date;
  updated_at!: Date;
}

export class PaginatedPeopleResponseDto {
  items!: PersonResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
}
