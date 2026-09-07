import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { GraphIntegrationModule } from '../graph-integration/graph-integration.module';
import { KickoffController } from './controllers/kickoff.controller';
import { Kickoff, KickoffApproval, KickoffInvitee } from './models';
import { KickoffService } from './services/kickoff.service';

/**
 * Cierre de Oferta — por ahora solo el Kickoff de la venta ganada.
 *
 * Depende de `GraphIntegrationModule` para cancelar en Microsoft 365 el evento
 * asociado cuando se elimina el kickoff.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([Kickoff, KickoffInvitee, KickoffApproval]),
    GraphIntegrationModule,
  ],
  controllers: [KickoffController],
  providers: [KickoffService],
  exports: [KickoffService],
})
export class OfferClosingModule {}
