import {
  Controller,
  Get,
  Headers,
  Param,
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
import { MepProblemFilter } from '../filters/mep-problem.filter';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { ConcurrencyLimitInterceptor } from '../interceptors/concurrency-limit.interceptor';
import { presentOpportunity } from '../presenters/contract.presenter';
import { AccessAuditService } from '../services/access-audit.service';
import { OpportunityService } from '../services/opportunity.service';

/**
 * Operación 3 del contrato — §6.3 (T-104).
 *
 * Solo lectura, por diseño. No existe ningún verbo de escritura sobre la OUV
 * en esta superficie: el arquetipo comercial, el valor, la etapa, el estado y
 * el propietario son autoridad exclusiva del CRM (INV-11, TS-OUV-04).
 */
@Controller('v1/commercial-opportunities')
@Public()
@UseFilters(MepProblemFilter)
@UseGuards(ApiKeyGuard, RateLimitGuard)
@UseInterceptors(ConcurrencyLimitInterceptor)
export class CommercialOpportunitiesController {
  constructor(
    private readonly opportunityService: OpportunityService,
    private readonly accessAudit: AccessAuditService,
  ) {}

  @Get(':opportunity_ref')
  @RequireScope(MEP_SCOPES.OPPORTUNITIES_READ)
  @RateLimited(RateLimitClass.READ_ITEM)
  async findOne(
    @Param('opportunity_ref') opportunityRef: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const opportunity = await this.opportunityService.findByRef(opportunityRef);

    if (!opportunity) {
      void this.accessAudit.recordOpportunityRead(request, opportunityRef, 404);
      throw MepProblemException.notFound(
        'La oportunidad indicada no existe o no es visible para esta identidad.',
      );
    }

    response.setHeader('ETag', opportunity.etag);

    if (ifNoneMatch && etagMatches(ifNoneMatch, opportunity.etag)) {
      void this.accessAudit.recordOpportunityRead(request, opportunityRef, 304);
      response.status(304);
      return undefined;
    }

    void this.accessAudit.recordOpportunityRead(request, opportunityRef, 200);

    // INV-09: todas las claves presentes; los opcionales sin valor van `null`.
    return presentOpportunity(opportunity);
  }
}
