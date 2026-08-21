import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tax_id?: string | null;
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
}

export class AccountResponseDto {
  account_id!: string;
  name!: string;
  tax_id!: string | null;
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
}

export class PersonResponseDto {
  person_id!: string;
  name!: string;
  job_title!: string | null;
  email!: string | null;
  phone!: string | null;
  account_id!: string;
  account_name?: string | null;
  created_at!: Date;
  updated_at!: Date;
}

export class PaginatedPeopleResponseDto {
  items!: PersonResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
}
