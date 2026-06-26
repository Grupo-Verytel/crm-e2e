import { ConfigService } from '@nestjs/config';
import { SequelizeModuleOptions } from '@nestjs/sequelize';

export function buildDatabaseConfig(
  configService: ConfigService,
): SequelizeModuleOptions {
  const logging = configService.get<string>('DB_LOGGING', 'false') === 'true';

  return {
    dialect: configService.get<'mysql'>('DB_DIALECT', 'mysql'),
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT', 3306),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE'),
    autoLoadModels: true,
    synchronize: false,
    logging,
    timezone: '+00:00',
  };
}
