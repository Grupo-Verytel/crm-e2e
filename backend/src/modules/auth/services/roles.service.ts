import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AUTH_ERROR_CODES } from '../constants/auth.constants';
import { CaslPermissionRule } from '../casl/casl-permission.interface';
import { RoleResponseDto, UpdateRoleDto } from '../dtos/role-response.dto';
import { Role } from '../models';

@Injectable()
export class RolesService {
  constructor(@InjectModel(Role) private readonly roleModel: typeof Role) {}

  async findAll(): Promise<RoleResponseDto[]> {
    const roles = await this.roleModel.findAll({
      order: [['name', 'ASC']],
    });

    return roles.map((role) => this.toResponseDto(role));
  }

  async update(roleId: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    const role = await this.roleModel.findByPk(roleId);

    if (!role) {
      throw new NotFoundException({
        code: AUTH_ERROR_CODES.NOT_FOUND,
        message: 'Role not found',
      });
    }

    await role.update({
      description: dto.description ?? role.description,
      permissions: dto.permissions,
    });

    return this.toResponseDto(role);
  }

  private toResponseDto(role: Role): RoleResponseDto {
    return {
      role_id: role.roleId,
      name: role.name,
      description: role.description,
      permissions: this.parsePermissions(role.permissions),
      is_system: role.isSystem,
    };
  }

  private parsePermissions(
    permissions: Role['permissions'],
  ): CaslPermissionRule[] {
    if (Array.isArray(permissions)) {
      return permissions as CaslPermissionRule[];
    }

    if (typeof permissions === 'string') {
      return JSON.parse(permissions) as CaslPermissionRule[];
    }

    return [];
  }
}
