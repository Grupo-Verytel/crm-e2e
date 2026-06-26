import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';
import type { StringValue } from 'ms';
import { AdminGuard } from './guards/admin.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshToken, Role, User } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([Role, User, RefreshToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_EXPIRES_IN',
            '15m',
          ) as StringValue,
        },
      }),
    }),
  ],
  providers: [JwtAuthGuard, AdminGuard],
  exports: [SequelizeModule, JwtModule, JwtAuthGuard, AdminGuard],
})
export class AuthModule {}
