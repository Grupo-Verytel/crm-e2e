import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { DiscoveryModule } from '../discovery/discovery.module';
import { GraphIntegrationModule } from '../graph-integration/graph-integration.module';
import { ExecutingCompanyController } from './controllers/executing-company.controller';
import { KickoffController } from './controllers/kickoff.controller';
import { WonSaleListController } from './controllers/won-sale-list.controller';
import { WonSaleController } from './controllers/won-sale.controller';
import {
  JointVenture,
  Kickoff,
  KickoffApproval,
  KickoffInvitee,
  Partner,
  WonSale,
  WonSaleAlert,
  WonSaleHistoryEntry,
  WonSaleMember,
  WonSaleValidation,
} from './models';
import { ExecutingCompanyService } from './services/executing-company.service';
import { KickoffService } from './services/kickoff.service';
import { WonSaleService } from './services/won-sale.service';

/**
 * Cierre de Oferta: el expediente de la venta ganada y su Kickoff.
 *
 * Depende de `GraphIntegrationModule` para cancelar en Microsoft 365 el evento
 * asociado cuando se elimina el kickoff.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([
      Kickoff,
      KickoffInvitee,
      KickoffApproval,
      WonSale,
      WonSaleValidation,
      WonSaleMember,
      WonSaleAlert,
      WonSaleHistoryEntry,
      JointVenture,
      Partner,
    ]),
    GraphIntegrationModule,
    DiscoveryModule,
  ],
  controllers: [
    KickoffController,
    WonSaleController,
    WonSaleListController,
    ExecutingCompanyController,
  ],
  providers: [KickoffService, WonSaleService, ExecutingCompanyService],
  exports: [KickoffService, WonSaleService],
})
export class OfferClosingModule {}
