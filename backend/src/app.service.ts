import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize';

@Injectable()
export class AppService {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  getHello(): string {
    return 'Hello World!';
  }

  async checkDatabaseConnection(): Promise<{
    status: string;
    database: string;
  }> {
    await this.sequelize.authenticate();
    return { status: 'ok', database: 'connected' };
  }
}
