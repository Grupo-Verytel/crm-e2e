import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { createHash, randomBytes } from 'crypto';
import { RefreshToken, Role, User } from '../models';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(RefreshToken)
    private readonly refreshTokenModel: typeof RefreshToken,
  ) {}

  async issueTokenPair(user: User, role: Role): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.userId,
      role: role.name,
    });

    const refreshToken = randomBytes(64).toString('hex');
    const tokenHash = this.hashRefreshToken(refreshToken);

    await this.refreshTokenModel.create({
      userId: user.userId,
      tokenHash,
      expiresAt: this.getRefreshExpiresAt(),
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    };
  }

  async rotateRefreshToken(
    refreshToken: string,
    user: User,
    role: Role,
  ): Promise<TokenPair> {
    const storedToken = await this.findValidRefreshToken(refreshToken);

    await storedToken.update({ revokedAt: new Date() });

    return this.issueTokenPair(user, role);
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const storedToken = await this.findValidRefreshToken(refreshToken);
    await storedToken.update({ revokedAt: new Date() });
  }

  async findValidRefreshToken(refreshToken: string): Promise<RefreshToken> {
    const tokenHash = this.hashRefreshToken(refreshToken);

    const storedToken = await this.refreshTokenModel.findOne({
      where: {
        tokenHash,
        revokedAt: null,
      },
    });

    if (!storedToken || storedToken.expiresAt.getTime() <= Date.now()) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    return storedToken;
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private getRefreshExpiresAt(): Date {
    const duration = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    return new Date(Date.now() + this.parseDurationMs(duration));
  }

  private parseDurationMs(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());

    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const amount = Number.parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return amount * 1000;
      case 'm':
        return amount * 60 * 1000;
      case 'h':
        return amount * 60 * 60 * 1000;
      case 'd':
        return amount * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}
