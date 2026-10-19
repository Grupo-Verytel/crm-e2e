import { Controller, Get, Param } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { OuvRecordatorioListItemDto } from '../dtos/ouv-response.dto';
import { OuvInteraccionesService } from '../services/ouv-interacciones.service';

/**
 * Reminders hanging off the interactions of one OUV.
 * Read uses the same ownership rule as the OUV detail.
 */
@Controller('discovery/ouvs/:ouvId/recordatorios')
export class OuvRecordatoriosController {
  constructor(private readonly interactions: OuvInteraccionesService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  list(
    @Param('ouvId') ouvId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvRecordatorioListItemDto[]> {
    return this.interactions.listRecordatorios(
      ouvId,
      user.userId,
      user.roleName,
    );
  }
}
