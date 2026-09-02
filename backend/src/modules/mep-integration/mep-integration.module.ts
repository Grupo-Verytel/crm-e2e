import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CommercialInteractionsController } from './controllers/commercial-interactions.controller';
import { CommercialOpportunitiesController } from './controllers/commercial-opportunities.controller';
import { MepProblemFilter } from './filters/mep-problem.filter';
import { ApiKeyGuard } from './guards/api-key.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { ConcurrencyLimitInterceptor } from './interceptors/concurrency-limit.interceptor';
import { MepRequestMiddleware } from './middleware/mep-request.middleware';
import { MEP_INTEGRATION_MODELS } from './models';
import { AccessAuditService } from './services/access-audit.service';
import { ApiKeyService } from './services/api-key.service';
import { IdempotencyService } from './services/idempotency.service';
import { IntakeService } from './services/intake.service';
import { MepAuditService } from './services/mep-audit.service';
import { MepResponseService } from './services/mep-response.service';
import { OpportunityService } from './services/opportunity.service';
import { ProcessingReceiptService } from './services/processing-receipt.service';
import { RateLimitService } from './services/rate-limit.service';
import { ReceiptSemanticValidator } from './validation/receipt-semantic.validator';
import { ResponseSemanticValidator } from './validation/response-semantic.validator';

/**
 * Integración CRM Frisson ↔ MEP-LEAN — SPEC-CRM-MEPLEAN-001.
 *
 * El CRM es **servidor** y expone las 6 operaciones del contrato bajo `/v1`.
 * P-02: no hay cliente HTTP hacia MEP en ninguna parte de este módulo; toda la
 * superficie física es del CRM y MEP hace pull + write-back.
 *
 * Guards, filtro y middleware se aplican **solo** a esta superficie: el resto
 * del CRM conserva su JWT + CASL y su prefijo `api/v1` sin cambios.
 */
@Module({
  imports: [SequelizeModule.forFeature(MEP_INTEGRATION_MODELS)],
  controllers: [
    CommercialInteractionsController,
    CommercialOpportunitiesController,
  ],
  providers: [
    // Fase 0 — fundaciones
    ApiKeyService,
    ApiKeyGuard,
    RateLimitService,
    RateLimitGuard,
    ConcurrencyLimitInterceptor,
    IdempotencyService,
    MepAuditService,
    AccessAuditService,
    MepProblemFilter,
    // Validadores semánticos
    ReceiptSemanticValidator,
    ResponseSemanticValidator,
    // Fase 1 — lectura
    IntakeService,
    OpportunityService,
    // Fase 2 — escritura
    ProcessingReceiptService,
    MepResponseService,
  ],
  exports: [ApiKeyService, MepAuditService, IdempotencyService],
})
export class MepIntegrationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(MepRequestMiddleware)
      .forRoutes(
        CommercialInteractionsController,
        CommercialOpportunitiesController,
      );
  }
}
