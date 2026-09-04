import { MepApiIdentity } from '../interfaces/mep-request-context.interface';

/** Resultado de una escritura del contrato, listo para el controlador. */
export interface MepWriteResult {
  status: number;
  body: unknown;
  etag: string | null;
  /** Header `Location`, solo en la creación de un acuse (201, §6.4). */
  location?: string;
  /** `true` cuando la respuesta proviene de un replay idempotente (INV-29). */
  replay: boolean;
}

/** Todo lo que una escritura necesita saber de la petición para auditarla. */
export interface MepWriteContext {
  correlationId: string;
  requestId: string;
  identity: MepApiIdentity;
  sourceIp: string | null;
  httpMethod: string;
  httpPath: string;
  idempotencyKey: string;
  ifMatch: string | null;
  /** Cuerpo crudo, previo al pipe — barrido de la frontera LEAN (§7.4). */
  rawBody: unknown;
  startedAt: number;
}
