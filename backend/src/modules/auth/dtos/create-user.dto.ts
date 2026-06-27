import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  full_name: string;

  @IsUUID('4')
  role_id: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
