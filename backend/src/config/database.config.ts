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
    // Sin esto mysql2 negocia `utf8mb3` y MySQL sustituye por `?` todo
    // carácter de 4 bytes (emojis, entre otros). Las tablas ya son utf8mb4;
    // lo que faltaba era la conexión. Es requisito de P-07 / INV-07:
    // `source_content` se preserva byte a byte, sin alteración.
    dialectOptions: { charset: 'utf8mb4' },
  };
}
