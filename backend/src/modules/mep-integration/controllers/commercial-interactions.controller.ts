import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { RateLimitClass } from '../constants/rate-limit.constants';
import { MEP_SCOPES } from '../constants/scopes';
import { RateLimited } from '../decorators/rate-limit-class.decorator';
import { RequireScope } from '../decorators/require-scope.decorator';
import { etagMatches } from '../domain/etag';
import { MepProblemException } from '../domain/mep-problem.exception';
import { CreateProcessingReceiptDto } from '../dtos/create-processing-receipt.dto';
import { GetResponseQueryDto } from '../dtos/get-response-query.dto';
import { ListInteractionsQueryDto } from '../dtos/list-interactions-query.dto';
import { PublishResponseDto } from '../dtos/publish-response.dto';
import { MepProblemFilter } from '../filters/mep-problem.filter';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { ConcurrencyLimitInterceptor } from '../interceptors/concurrency-limit.interceptor';
import { presentInteraction } from '../presenters/contract.presenter';
import { AccessAuditService } from '../services/access-audit.service';
import { IdempotencyService } from '../services/idempotency.service';
import { IntakeService } from '../services/intake.service';
import { MepResponseService } from '../services/mep-response.service';
import { ProcessingReceiptService } from '../services/processing-receipt.service';
import { MepWriteContext } from '../services/write-result.interface';
import { createMepValidationPipe } from '../validation/mep-validation.pipe';

/**
 * Operaciones 1, 2, 4, 5 y 6 del contrato — §6.1, §6.2, §6.4, §6.5, §6.6.
 *
 * `@Public()` desactiva el guard JWT global del CRM: esta superficie se
 * autentica exclusivamente con `X-API-Key` (§5.1), que es una identidad de
 * servicio, no un usuario nominal.
 *
 * P-02: todas las rutas son del CRM. Este módulo no expone ni invoca ningún
 * endpoint de MEP-LEAN.
 */
@Controller('v1/commercial-interactions')
@Public()
@UseFilters(MepProblemFilter)
@UseGuards(ApiKeyGuard, RateLimitGuard)
@UseInterceptors(ConcurrencyLimitInterceptor)
export class CommercialInteractionsController {
  constructor(
    private readonly intakeService: IntakeService,
    private readonly receiptService: ProcessingReceiptService,
    private readonly responseService: MepResponseService,
    private readonly idempotency: IdempotencyService,
    private readonly accessAudit: AccessAuditService,
  ) {}

  // ------------------------------------------------- 1. pull paginado (§6.1)

  @Get()
  @RequireScope(MEP_SCOPES.INTERACTIONS_READ)
  @RateLimited(RateLimitClass.READ_LIST)
  async list(
    // Enum desconocido en query es 400, no 422 (§6.1).
    @Query(createMepValidationPipe({ enumStatus: 400 }))
    query: ListInteractionsQueryDto,
    @Req() request: Request,
  ) {
    const page = await this.intakeService.listInteractions(query);

    void this.accessAudit.recordIntakePoll(request, {
      count: page.items.length,
      cursorIn: query.cursor ?? null,
      nextCursor: page.next_cursor,
      highWatermark: page.high_watermark,
    });

    return page;
  }

  // --------------------------------------------- 2. relectura por id (§6.2)

  @Get(':interaction_ref')
  @RequireScope(MEP_SCOPES.INTERACTIONS_READ)
  @RateLimited(RateLimitClass.READ_ITEM)
  async findOne(
    @Param('interaction_ref') interactionRef: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const interaction = await this.intakeService.findByRef(interactionRef);

    if (!interaction) {
      throw MepProblemException.notFound(
        'La interacción indicada no existe o no es visible para esta identidad.',
      );
    }

    // INV-08: el `etag` del cuerpo y el header `ETag` son el mismo valor.
    response.setHeader('ETag', interaction.etag);

    if (ifNoneMatch && etagMatches(ifNoneMatch, interaction.etag)) {
      response.status(304);
      return undefined;
    }

    return presentInteraction(interaction);
  }

  // ------------------------------------------- 4. acuse técnico (§6.4)

  @Post(':interaction_ref/processing-receipts')
  @RequireScope(MEP_SCOPES.RECEIPTS_WRITE)
  @RateLimited(RateLimitClass.WRITE)
  async createReceipt(
    @Param('interaction_ref') interactionRef: string,
    @Body(createMepValidationPipe()) payload: CreateProcessingReceiptDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const context = this.writeContext(request);
    const result = await this.receiptService.create(
      interactionRef,
      payload,
      context,
    );

    response.status(result.status);
    if (result.etag) {
      response.setHeader('ETag', result.etag);
    }
    if (result.location) {
      response.setHeader('Location', result.location);
    }

    return result.body;
  }

  // ----------------------------------- 5. respuesta comercial agregada (§6.5)

  @Put(':interaction_ref/responses/:response_id')
  @RequireScope(MEP_SCOPES.RESPONSES_WRITE)
  @RateLimited(RateLimitClass.WRITE)
  async publishResponse(
    @Param('interaction_ref') interactionRef: string,
    @Param('response_id') responseId: string,
    @Body(createMepValidationPipe()) payload: PublishResponseDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const context = this.writeContext(request);
    const result = await this.responseService.publish(
      interactionRef,
      responseId,
      payload,
      context,
    );

    response.status(result.status);
    if (result.etag) {
      response.setHeader('ETag', result.etag);
    }

    return result.body;
  }

  // ------------------------------------ 6. verificación post-write (§6.6)

  @Get(':interaction_ref/responses/:response_id')
  @RequireScope(MEP_SCOPES.RESPONSES_READ)
  @RateLimited(RateLimitClass.READ_ITEM)
  async readResponse(
    @Param('interaction_ref') interactionRef: string,
    @Param('response_id') responseId: string,
    @Query(createMepValidationPipe({ enumStatus: 400 }))
    query: GetResponseQueryDto,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.responseService.read(
      interactionRef,
      responseId,
      query.version,
    );

    response.setHeader('ETag', result.etag);

    if (ifNoneMatch && etagMatches(ifNoneMatch, result.etag)) {
      response.status(304);
      return undefined;
    }

    // INV-15: exactamente la misma representación persistida que devolvió el
    // `PUT`, con el mismo `ETag` y el mismo orden de `service_results[]`.
    return result.body;
  }

  /** Reúne lo que las escrituras necesitan de la petición (§5.2, §12.1). */
  private writeContext(request: Request): MepWriteContext {
    const mep = request.mep;
    const identity = mep?.identity;

    if (!mep || !identity) {
      // El guard de API key ya garantizó ambos; esto solo protege el tipo.
      throw MepProblemException.unauthorized();
    }

    const idempotencyKey = this.idempotency.assertValidKey(
      this.header(request, 'idempotency-key'),
    );

    return {
      correlationId: mep.correlationId,
      requestId: mep.requestId,
      identity,
      sourceIp: request.ip ?? null,
      httpMethod: request.method,
      httpPath: request.originalUrl?.split('?')[0] ?? request.path,
      idempotencyKey,
      ifMatch: this.header(request, 'if-match') ?? null,
      // Cuerpo crudo tal como llegó: el pipe de validación no muta `req.body`,
      // así que aquí siguen presentes las propiedades que la lista blanca
      // descarta — que es justo lo que el barrido de §7.4 necesita ver.
      rawBody: request.body,
      startedAt: mep.startedAt,
    };
  }

  private header(request: Request, name: string): string | undefined {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
