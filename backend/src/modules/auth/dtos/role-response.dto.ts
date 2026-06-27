import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CaslPermissionRule } from '../casl/casl-permission.interface';

export class CaslPermissionRuleDto implements CaslPermissionRule {
  @IsString()
  action: string;

  @IsString()
  subject: string;

  @IsOptional()
  conditions?: Record<string, unknown>;
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  description?: string;

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => CaslPermissionRuleDto)
  permissions: CaslPermissionRuleDto[];
}

export class RoleResponseDto {
  role_id: string;
  name: string;
  description: string | null;
  permissions: CaslPermissionRule[];
  is_system: boolean;
}
