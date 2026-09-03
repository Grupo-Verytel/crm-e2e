export { CommercialInteraction } from './commercial-interaction.model';
export { InteractionRequestedService } from './interaction-requested-service.model';
export { CommercialOpportunity } from './commercial-opportunity.model';
export { ProcessingReceipt } from './processing-receipt.model';
export { MepResponse } from './mep-response.model';
export { MepResponseVersion } from './mep-response-version.model';
export { MepServiceResult } from './mep-service-result.model';
export { MepDeliverable } from './mep-deliverable.model';
export {
  IdempotencyRecord,
  IdempotencyStatus,
} from './idempotency-record.model';
export { MepApiKey, ApiKeyEnvironment } from './mep-api-key.model';
export {
  MepAuditLog,
  AuditActorType,
  AuditOutcome,
} from './mep-audit-log.model';

import { CommercialInteraction } from './commercial-interaction.model';
import { InteractionRequestedService } from './interaction-requested-service.model';
import { CommercialOpportunity } from './commercial-opportunity.model';
import { ProcessingReceipt } from './processing-receipt.model';
import { MepResponse } from './mep-response.model';
import { MepResponseVersion } from './mep-response-version.model';
import { MepServiceResult } from './mep-service-result.model';
import { MepDeliverable } from './mep-deliverable.model';
import { IdempotencyRecord } from './idempotency-record.model';
import { MepApiKey } from './mep-api-key.model';
import { MepAuditLog } from './mep-audit-log.model';

/** Modelos registrados en `SequelizeModule.forFeature` del módulo. */
export const MEP_INTEGRATION_MODELS = [
  CommercialInteraction,
  InteractionRequestedService,
  CommercialOpportunity,
  ProcessingReceipt,
  MepResponse,
  MepResponseVersion,
  MepServiceResult,
  MepDeliverable,
  IdempotencyRecord,
  MepApiKey,
  MepAuditLog,
];
