import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { DemandGenerationModule } from './modules/demand-generation/demand-generation.module';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule, DemandGenerationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
