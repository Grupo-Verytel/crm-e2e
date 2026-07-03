import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuditAction } from '../../audit/models/audit-action.enum';
import { AuditService } from '../../audit/services/audit.service';
import {
  AUTH_ERROR_CODES,
  INVALID_CREDENTIALS_MESSAGE,
  LOCKOUT_DURATION_MS,
  LOCKOUT_THRESHOLD,
} from '../constants/auth.constants';
import {
  AuthTokenResponseDto,
  MeResponseDto,
  PermissionRuleDto,
} from '../dtos/auth-response.dto';
import { LoginDto } from '../dtos/login.dto';
import { Role, User } from '../models';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokenResponseDto> {
    const user = await this.userModel.findOne({
      where: { email: dto.email.toLowerCase() },
      include: [Role],
    });

    if (!user) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: INVALID_CREDENTIALS_MESSAGE,
      });
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        code: AUTH_ERROR_CODES.USER_INACTIVE,
        message: 'User account is inactive',
      });
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: INVALID_CREDENTIALS_MESSAGE,
      });
    }

    const passwordValid = await this.passwordService.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      await this.registerFailedLogin(user);
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: INVALID_CREDENTIALS_MESSAGE,
      });
    }

    await user.update({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });

    const tokens = await this.tokenService.issueTokenPair(user, user.role);

    await this.auditService.recordSecurityEvent({
      accion: AuditAction.LOGIN,
      tabla: 'users',
      registro_id: user.userId,
      contexto: { email: user.email },
    });

    return tokens;
  }

  async refresh(refreshToken: string): Promise<AuthTokenResponseDto> {
    try {
      const storedToken =
        await this.tokenService.findValidRefreshToken(refreshToken);

      const user = await this.userModel.findByPk(storedToken.userId, {
        include: [Role],
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_CODES.UNAUTHORIZED,
          message: 'Invalid or expired refresh token',
        });
      }

      return this.tokenService.rotateRefreshToken(
        refreshToken,
        user,
        user.role,
      );
    } catch {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid or expired refresh token',
      });
    }
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      await this.tokenService.revokeRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid or expired refresh token',
      });
    }

    return { message: 'Logged out successfully' };
  }

  async getMe(userId: string): Promise<MeResponseDto> {
    const user = await this.userModel.findByPk(userId, {
      include: [Role],
    });

    if (!user) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
        message: 'User not found',
      });
    }

    return this.toMeResponse(user);
  }

  private async registerFailedLogin(user: User): Promise<void> {
    const failedAttempts = user.failedLoginAttempts + 1;
    const updates: Partial<User> = {
      failedLoginAttempts: failedAttempts,
    };

    if (failedAttempts >= LOCKOUT_THRESHOLD) {
      updates.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    await user.update(updates);
  }

  private toMeResponse(user: User): MeResponseDto {
    return {
      user_id: user.userId,
      email: user.email,
      full_name: user.fullName,
      role_id: user.roleId,
      role_name: user.role.name,
      is_active: user.isActive,
      last_login_at: user.lastLoginAt,
      permissions: this.normalizePermissions(user.role.permissions),
    };
  }

  private normalizePermissions(raw: unknown): PermissionRuleDto[] {
    const list: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (!Array.isArray(list)) {
      return [];
    }

    return (list as unknown[]).flatMap((entry) => {
      if (entry && typeof entry === 'object') {
        const rule = entry as { action?: unknown; subject?: unknown };
        if (
          typeof rule.action === 'string' &&
          typeof rule.subject === 'string'
        ) {
          return [{ action: rule.action, subject: rule.subject }];
        }
      }
      return [];
    });
  }
}
