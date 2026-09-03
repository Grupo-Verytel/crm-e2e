import {
  Global,
  INestApplication,
  Module,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { CrmValidationPipe } from '../../config/crm-validation.pipe';
import {
  mepBodyParserErrorHandler,
  mepJsonBodyParser,
} from './middleware/mep-body-limit';
import { MAX_IN_FLIGHT_PER_KEY } from './constants/rate-limit.constants';
import { MEP_CONTRACT_ROUTES } from './mep-contract-routes';
import { MEP_INTEGRATION_MODELS } from './models';
import { MepIntegrationModule } from './mep-integration.module';
import { ApiKeyService } from './services/api-key.service';
import { MepAuditService } from './services/mep-audit.service';
import { RateLimitService } from './services/rate-limit.service';

/**
 * Cableado HTTP del contrato — verifica lo que solo se ve con la app montada:
 * la ruta base `/v1` (§Base path), el orden guard → filtro, el formato
 * `problem+json` y los headers transversales.
 *
 * No toca base de datos: los modelos y la conexión se sustituyen por dobles.
 */
/** Forma del `problem+json` que devuelve el contrato (§5.4). */
interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  correlation_id?: string;
  errors?: { pointer: string; code: string }[];
}

/** `response.body` de supertest es `any`; esto le da forma sin castear en cada test. */
const problemOf = (response: { body: unknown }): ProblemBody =>
  response.body as ProblemBody;

describe('cableado HTTP del contrato — §5 / §6', () => {
  let app: INestApplication;

  const config: Record<string, string> = {
    MEP_REQUIRE_HTTPS: 'false',
    MEP_API_ENVIRONMENT: 'sandbox',
    MEP_CURSOR_SECRET: 'secreto-de-prueba',
    MEP_API_KEY_PEPPER: 'pepper-de-prueba',
  };

  /**
   * En la app real, `ConfigService` y `Sequelize` llegan de módulos globales
   * (`ConfigModule.forRoot({ isGlobal: true })` y `SequelizeModule.forRoot`).
   * Aquí se sustituyen por dobles, también globales, para montar el módulo sin
   * base de datos ni fichero `.env`.
   */
  @Global()
  @Module({
    providers: [
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, fallback?: unknown) => config[key] ?? fallback,
          getOrThrow: (key: string) => {
            if (config[key] === undefined) {
              throw new Error(`Falta ${key}`);
            }
            return config[key];
          },
        },
      },
      { provide: Sequelize, useValue: { transaction: jest.fn() } },
    ],
    exports: [ConfigService, Sequelize],
  })
  class TestInfrastructureModule {}

  beforeAll(async () => {
    const moduleRef = Test.createTestingModule({
      imports: [TestInfrastructureModule, MepIntegrationModule],
    });

    for (const model of MEP_INTEGRATION_MODELS) {
      moduleRef
        .overrideProvider(getModelToken(model))
        .useValue({ findOne: jest.fn(), findAll: jest.fn() });
    }

    // Ninguna petición de esta suite llega a persistir; la auditoría se
    // sustituye para aislar el cableado HTTP.
    moduleRef
      .overrideProvider(MepAuditService)
      .useValue({ record: jest.fn(), verifyChain: jest.fn() });

    const compiled = await moduleRef.compile();

    app = compiled.createNestApplication<NestExpressApplication>();

    // Mismo montaje que `main.ts`.
    app.use('/v1', mepJsonBodyParser());
    app.use(mepBodyParserErrorHandler());
    app.setGlobalPrefix('api/v1', {
      exclude: MEP_CONTRACT_ROUTES.map((path) => ({
        path,
        method: RequestMethod.ALL,
      })),
    });
    app.useGlobalPipes(new CrmValidationPipe());

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('§Base path: las 6 operaciones se publican bajo `/v1`, no bajo `api/v1`', async () => {
    // 401 (no 404) prueba que la ruta existe y que el guard de API key corre.
    await request(app.getHttpServer())
      .get('/v1/commercial-interactions')
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/v1/commercial-interactions')
      .expect(404);
  });

  it('TS-SEC-01: sin `X-API-Key` la respuesta es 401 en `problem+json`', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/commercial-interactions')
      .expect(401);

    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(problemOf(response)).toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      type: 'https://api.frisson.crm/problems/unauthorized',
    });
  });

  it('TS-SEC-02: una clave desconocida devuelve el mismo 401 genérico', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/commercial-interactions')
      .set('X-API-Key', 'mep_sandbox_clave-inexistente-0000')
      .expect(401);

    // No revela cuál de los casos (ausente / inválida / revocada / expirada).
    expect(problemOf(response).code).toBe('UNAUTHORIZED');
    expect(JSON.stringify(problemOf(response))).not.toContain(
      'clave-inexistente',
    );
  });

  it('TS-SEC-07: la clave en query string no autentica', async () => {
    await request(app.getHttpServer())
      .get('/v1/commercial-interactions?api_key=mep_sandbox_loquesea')
      .expect(401);
  });

  it('§6: toda respuesta lleva `X-Correlation-ID` (eco del recibido)', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/commercial-interactions')
      .set('X-Correlation-ID', 'corr_01JCRM20004')
      .expect(401);

    expect(response.headers['x-correlation-id']).toBe('corr_01JCRM20004');
    expect(problemOf(response).correlation_id).toBe('corr_01JCRM20004');
  });

  it('§6: si no viene `X-Correlation-ID`, el CRM genera uno', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/commercial-interactions')
      .expect(401);

    expect(response.headers['x-correlation-id']).toMatch(/^corr_/);
  });

  it('§10.3: HSTS presente en la superficie del contrato', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/commercial-interactions')
      .expect(401);

    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });

  it('TS-SEC-12: `Content-Type: text/plain` en una escritura → 415', async () => {
    const response = await request(app.getHttpServer())
      .put('/v1/commercial-interactions/int_20004/responses/mep:x:response')
      .set('Content-Type', 'text/plain')
      .set('X-Correlation-ID', 'corr_1')
      .send('no soy json')
      .expect(415);

    expect(problemOf(response).code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
  });

  it('TS-IDEM-05 / §5.2: falta `X-Correlation-ID` en una escritura → 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/commercial-interactions/int_20004/processing-receipts')
      .set('Content-Type', 'application/json')
      .send({})
      .expect(400);

    expect(problemOf(response).code).toBe('MISSING_CORRELATION_ID');
  });

  it('TS-SEC-11: un cuerpo de 300 KB → 413 en `problem+json`', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/commercial-interactions/int_20004/processing-receipts')
      .set('Content-Type', 'application/json')
      .set('X-Correlation-ID', 'corr_1')
      .send({ receipt_id: 'x'.repeat(300 * 1024) })
      .expect(413);

    expect(problemOf(response).code).toBe('PAYLOAD_TOO_LARGE');
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
  });

  it('§10.3: un cuerpo por debajo de 256 KB sí lo acepta el parser del contrato', async () => {
    // El límite del CRM (100 KB por defecto) no debe estrechar el contrato:
    // un payload de 150 KB tiene que pasar el parser y llegar a la validación.
    const response = await request(app.getHttpServer())
      .post('/v1/commercial-interactions/int_20004/processing-receipts')
      .set('Content-Type', 'application/json')
      .set('X-Correlation-ID', 'corr_1')
      .send({ receipt_id: 'x'.repeat(150 * 1024) });

    expect(response.status).not.toBe(413);
  });

  it('INV-11 / TS-OUV-04: no existe verbo de escritura sobre la OUV', async () => {
    for (const method of ['post', 'put', 'patch', 'delete'] as const) {
      await request(app.getHttpServer())
        [method]('/v1/commercial-opportunities/ouv_9101')
        .set('Content-Type', 'application/json')
        .set('X-Correlation-ID', 'corr_1')
        .expect(404);
    }
  });

  it('§10.2: 401 y 403 son códigos distintos con causas distintas', async () => {
    // Identidad válida, pero sin el scope de la operación.
    const apiKeyService = app.get(ApiKeyService);
    jest.spyOn(apiKeyService, 'verify').mockResolvedValueOnce({
      apiKeyId: '1',
      identity: 'mep-lean',
      environment: 'sandbox',
      keyPrefix: 'mep_sandbox',
      scopes: [],
      rateTier: 'default',
    });

    const response = await request(app.getHttpServer())
      .get('/v1/commercial-interactions')
      .set('X-API-Key', 'mep_sandbox_clave-valida-de-prueba')
      .expect(403);

    expect(problemOf(response).code).toBe('INSUFFICIENT_SCOPE');
  });

  it('TS-RL-02: los headers RateLimit-* acompañan a la respuesta', async () => {
    const apiKeyService = app.get(ApiKeyService);
    jest.spyOn(apiKeyService, 'verify').mockResolvedValueOnce({
      apiKeyId: '2',
      identity: 'mep-lean',
      environment: 'sandbox',
      keyPrefix: 'mep_sandbox',
      scopes: ['interactions:read'],
      rateTier: 'default',
    });

    const response = await request(app.getHttpServer())
      .get('/v1/commercial-interactions?limit=0')
      .set('X-API-Key', 'mep_sandbox_clave-valida-de-prueba');

    expect(response.headers['ratelimit-limit']).toBeDefined();
    expect(response.headers['ratelimit-remaining']).toBeDefined();
    expect(response.headers['ratelimit-reset']).toBeDefined();
    expect(response.headers['ratelimit-policy']).toMatch(/;w=60$/);
  });

  it('§11.1: superar 20 peticiones simultáneas por credencial → 429', async () => {
    const apiKeyService = app.get(ApiKeyService);
    const rateLimitService = app.get(RateLimitService);
    rateLimitService.reset();

    jest.spyOn(apiKeyService, 'verify').mockResolvedValue({
      apiKeyId: 'concurrencia',
      identity: 'mep-lean',
      environment: 'sandbox',
      keyPrefix: 'mep_sandbox',
      scopes: ['interactions:read'],
      rateTier: 'default',
    });

    // Se ocupan los 20 cupos con peticiones que nunca se cierran desde aquí.
    for (let i = 0; i < MAX_IN_FLIGHT_PER_KEY; i += 1) {
      expect(rateLimitService.acquireSlot('concurrencia')).toBe(true);
    }

    const response = await request(app.getHttpServer())
      .get('/v1/commercial-interactions')
      .set('X-API-Key', 'mep_sandbox_clave-valida-de-prueba')
      .expect(429);

    expect(problemOf(response).code).toBe('RATE_LIMIT_EXCEEDED');
    expect(response.headers['retry-after']).toBeDefined();

    // El cupo se devuelve al terminar cada petición: liberados los 20, la
    // siguiente vuelve a pasar el interceptor.
    for (let i = 0; i < MAX_IN_FLIGHT_PER_KEY; i += 1) {
      rateLimitService.releaseSlot('concurrencia');
    }

    const after = await request(app.getHttpServer())
      .get('/v1/commercial-interactions')
      .set('X-API-Key', 'mep_sandbox_clave-valida-de-prueba');

    expect(after.status).not.toBe(429);

    jest.restoreAllMocks();
    rateLimitService.reset();
  });

  it('TS-INT-08: `limit=0` es 400 con el catálogo del contrato', async () => {
    const apiKeyService = app.get(ApiKeyService);
    jest.spyOn(apiKeyService, 'verify').mockResolvedValue({
      apiKeyId: '3',
      identity: 'mep-lean',
      environment: 'sandbox',
      keyPrefix: 'mep_sandbox',
      scopes: ['interactions:read'],
      rateTier: 'default',
    });

    for (const limit of [0, 201]) {
      const response = await request(app.getHttpServer())
        .get(`/v1/commercial-interactions?limit=${limit}`)
        .set('X-API-Key', 'mep_sandbox_clave-valida-de-prueba')
        .expect(400);

      expect(problemOf(response).status).toBe(400);
      expect(response.headers['content-type']).toContain(
        'application/problem+json',
      );
    }

    jest.restoreAllMocks();
  });

  it('§6.1: un `service_horizon` desconocido en query es 400, no 422', async () => {
    const apiKeyService = app.get(ApiKeyService);
    jest.spyOn(apiKeyService, 'verify').mockResolvedValueOnce({
      apiKeyId: '4',
      identity: 'mep-lean',
      environment: 'sandbox',
      keyPrefix: 'mep_sandbox',
      scopes: ['interactions:read'],
      rateTier: 'default',
    });

    const response = await request(app.getHttpServer())
      .get('/v1/commercial-interactions?service_horizon=MANANA')
      .set('X-API-Key', 'mep_sandbox_clave-valida-de-prueba')
      .expect(400);

    expect(problemOf(response).code).toBe('UNKNOWN_ENUM_VALUE');
  });

  it('§7.4 / TS-LEAN-01: una propiedad fuera del contrato en el PUT es 422, no 400', async () => {
    const apiKeyService = app.get(ApiKeyService);
    jest.spyOn(apiKeyService, 'verify').mockResolvedValueOnce({
      apiKeyId: '5',
      identity: 'mep-lean',
      environment: 'sandbox',
      keyPrefix: 'mep_sandbox',
      scopes: ['responses:write'],
      rateTier: 'default',
    });

    const response = await request(app.getHttpServer())
      .put(
        '/v1/commercial-interactions/int_20004/responses/mep:int_20004:response',
      )
      .set('X-API-Key', 'mep_sandbox_clave-valida-de-prueba')
      .set('X-Correlation-ID', 'corr_1')
      .set('Idempotency-Key', 'idem-key-de-prueba-01')
      .send({
        response_id: 'mep:int_20004:response',
        response_version: 1,
        business_milestone: 'INTERACTION_RECEIVED',
        response_status: 'RECEIVED',
        responded_at: '2026-08-21T14:38:00Z',
        responded_by: { ref: 'mep_system', display_name: 'MEP-LEAN' },
        service_results: [
          {
            service: 'TECHNICAL_DESIGN',
            status: 'RECEIVED',
            outcome: null,
            dependency: 'NONE',
            summary: null,
            reason_code: null,
            deliverables: [],
          },
        ],
        narrative_note: null,
        delivered_interaction_type: null,
        semantic_fingerprint: '1'.repeat(64),
        evidence_url: 'https://algo',
      })
      .expect(422);

    expect(problemOf(response).code).toBe('UNKNOWN_PROPERTY');
    expect(problemOf(response).errors).toContainEqual({
      pointer: '/evidence_url',
      code: 'UNKNOWN_PROPERTY',
    });
  });
});
