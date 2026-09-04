import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CreatePresalesRequestDto } from './dtos/create-presales-request.dto';
import { PresalesRequestView } from './presales-request.presenter';
import { PresalesRequestsService } from './presales-requests.service';

/**
 * Solicitudes de preventa de una OUV — §14 Fase 3.
 *
 * Superficie **del CRM para su propia UI**: vive bajo el prefijo global
 * `api/v1`, la autentica el `JwtAuthGuard` global y la autoriza CASL con el
 * subject `Opportunity`, igual que el resto de discovery.
 *
 * Deliberadamente separada de `/v1/commercial-interactions`, que es el
 * contrato servidor-a-servidor de MEP-LEAN: esa se autentica con una
 * `X-API-Key` de service account, no admite CORS y jamás debe consumirse
 * desde el navegador (§5.1, §10.1, §10.3).
 */
@Controller('discovery/ouvs')
export class PresalesRequestsController {
  constructor(private readonly presalesRequests: PresalesRequestsService) {}

  @Get(':id/solicitudes-preventa')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  list(@Param('id') ouvId: string): Promise<PresalesRequestView[]> {
    return this.presalesRequests.listByOuv(ouvId);
  }

  @Get(':id/solicitudes-preventa/:interactionRef')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  findOne(
    @Param('id') ouvId: string,
    @Param('interactionRef') interactionRef: string,
  ): Promise<PresalesRequestView> {
    return this.presalesRequests.findByRef(ouvId, interactionRef);
  }

  @Post(':id/solicitudes-preventa')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  create(
    @Param('id') ouvId: string,
    @Body() payload: CreatePresalesRequestDto,
  ): Promise<PresalesRequestView> {
    return this.presalesRequests.create(ouvId, payload);
  }
}
