import {
  Controller,
  Get,
  Headers,
  Param,
  Res,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { RateLimitClass } from '../constants/rate-limit.constants';
import { MEP_SCOPES } from '../constants/scopes';
import { RateLimited } from '../decorators/rate-limit-class.decorator';
import { RequireScope } from '../decorators/require-scope.decorator';
import { etagMatches } from '../domain/etag';
import { MepProblemFilter } from '../filters/mep-problem.filter';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { ConcurrencyLimitInterceptor } from '../interceptors/concurrency-limit.interceptor';
import { OuvContextService } from '../services/ouv-context.service';

/**
 * Lectura contextual de la OUV para un consumidor externo.
 *
 * Misma superficie que `GET /v1/commercial-opportunities/{opportunity_ref}`:
 * `/v1`, `X-API-Key`, scope `opportunities:read`. `{ouv_id}` es el consecutivo.
 *
 * Solo lectura. El header `ETag` es del agregado (oportunidad + historial
 * completo) y no se escribe en la OUV.
 */
@Controller('v1/ouv_context')
@Public()
@UseFilters(MepProblemFilter)
@UseGuards(ApiKeyGuard, RateLimitGuard)
@UseInterceptors(ConcurrencyLimitInterceptor)
export class OuvContextController {
  constructor(private readonly ouvContext: OuvContextService) {}

  @Get(':ouv_id')
  @RequireScope(MEP_SCOPES.OPPORTUNITIES_READ)
  @RateLimited(RateLimitClass.READ_LIST)
  async findOne(
    @Param('ouv_id') ouvId: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const body = await this.ouvContext.read(ouvId);

    response.setHeader('ETag', body.etag);

    if (ifNoneMatch && etagMatches(ifNoneMatch, body.etag)) {
      response.status(304);
      return undefined;
    }

    return body;
  }
}
