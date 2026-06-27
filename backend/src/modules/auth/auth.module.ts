import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';
import type { StringValue } from 'ms';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './controllers/auth.controller';
import { RolesController } from './controllers/roles.controller';
import { UsersController } from './controllers/users.controller';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import { AdminGuard } from './guards/admin.guard';
import { CaslGuard } from './guards/casl.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshToken, Role, User } from './models';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { RolesService } from './services/roles.service';
import { TokenService } from './services/token.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [
    forwardRef(() => AuditModule),
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
  controllers: [AuthController, UsersController, RolesController],
  providers: [
    AuthService,
    UsersService,
    RolesService,
    PasswordService,
    TokenService,
    CaslAbilityFactory,
    JwtAuthGuard,
    AdminGuard,
    CaslGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CaslGuard,
    },
  ],
  exports: [
    SequelizeModule,
    JwtModule,
    JwtAuthGuard,
    AdminGuard,
    CaslGuard,
    CaslAbilityFactory,
    AuthService,
    PasswordService,
    TokenService,
    UsersService,
    RolesService,
  ],
})
export class AuthModule {}
