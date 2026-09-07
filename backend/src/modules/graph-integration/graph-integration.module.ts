import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphController } from './controllers/graph.controller';
import { GraphClientService } from './services/graph-client.service';
import { GraphService } from './services/graph.service';

/**
 * Integración con Microsoft Graph (Entra ID app-only).
 *
 * Reutiliza las operaciones del toolkit interno `MicrosoftGraph`: usuarios por
 * dominio, disponibilidad de calendarios/salas y creación de reuniones de
 * Teams. La consume el agendamiento de Kickoff de Cierre de Oferta.
 */
@Module({
  imports: [ConfigModule],
  controllers: [GraphController],
  providers: [GraphClientService, GraphService],
  exports: [GraphService],
})
export class GraphIntegrationModule {}
