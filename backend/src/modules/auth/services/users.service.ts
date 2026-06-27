import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { AUTH_ERROR_CODES } from '../constants/auth.constants';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import {
  PaginatedUsersResponseDto,
  UserResponseDto,
  UsersQueryDto,
} from '../dtos/user-response.dto';
import { Role, User } from '../models';
import { PasswordService } from './password.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(Role) private readonly roleModel: typeof Role,
    private readonly passwordService: PasswordService,
  ) {}

  async findAll(query: UsersQueryDto): Promise<PaginatedUsersResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const { rows, count } = await this.userModel.findAndCountAll({
      include: [Role],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows.map((user) => this.toResponseDto(user)),
      total: count,
      page,
      limit,
    };
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    await this.ensureRoleExists(dto.role_id);

    try {
      const passwordHash = await this.passwordService.hash(dto.password);
      const user = await this.userModel.create({
        email: dto.email.toLowerCase(),
        passwordHash,
        fullName: dto.full_name,
        roleId: dto.role_id,
        isActive: dto.is_active ?? true,
      });

      await user.reload({ include: [Role] });
      return this.toResponseDto(user);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException({
          code: AUTH_ERROR_CODES.EMAIL_CONFLICT,
          message: 'Email already exists',
        });
      }

      throw error;
    }
  }

  async update(userId: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userModel.findByPk(userId, {
      include: [Role],
    });

    if (!user) {
      throw new NotFoundException({
        code: AUTH_ERROR_CODES.NOT_FOUND,
        message: 'User not found',
      });
    }

    if (dto.role_id) {
      await this.ensureRoleExists(dto.role_id);
    }

    try {
      const updates: Partial<User> = {};

      if (dto.email !== undefined) {
        updates.email = dto.email.toLowerCase();
      }

      if (dto.full_name !== undefined) {
        updates.fullName = dto.full_name;
      }

      if (dto.role_id !== undefined) {
        updates.roleId = dto.role_id;
      }

      if (dto.is_active !== undefined) {
        updates.isActive = dto.is_active;
      }

      if (dto.password !== undefined) {
        updates.passwordHash = await this.passwordService.hash(dto.password);
      }

      await user.update(updates);
      await user.reload({ include: [Role] });

      return this.toResponseDto(user);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException({
          code: AUTH_ERROR_CODES.EMAIL_CONFLICT,
          message: 'Email already exists',
        });
      }

      throw error;
    }
  }

  private async ensureRoleExists(roleId: string): Promise<void> {
    const role = await this.roleModel.findByPk(roleId);

    if (!role) {
      throw new NotFoundException({
        code: AUTH_ERROR_CODES.NOT_FOUND,
        message: 'Role not found',
      });
    }
  }

  private toResponseDto(user: User): UserResponseDto {
    return {
      user_id: user.userId,
      email: user.email,
      full_name: user.fullName,
      role_id: user.roleId,
      role_name: user.role.name,
      is_active: user.isActive,
      failed_login_attempts: user.failedLoginAttempts,
      locked_until: user.lockedUntil,
      last_login_at: user.lastLoginAt,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }
}
