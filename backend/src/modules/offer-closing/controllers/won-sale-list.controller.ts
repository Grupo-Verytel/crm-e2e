import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { ListWonSalesQueryDto, WonSaleListDto } from '../dtos/won-sale.dto';
import { WonSaleService } from '../services/won-sale.service';

/**
 * Listado de expedientes por OUV, para la bandeja de `/offers`.
 *
 * Vive aparte del controlador por OUV porque aquel cuelga de `:ouvId` y esta
 * ruta no tiene ninguno.
 */
@Controller('offer-closing/won-sales')
export class WonSaleListController {
  constructor(private readonly wonSaleService: WonSaleService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'WonSale' })
  list(
    @Query() query: ListWonSalesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WonSaleListDto> {
    const ouvIds = (query.ouvIds ?? '').split(',').filter(Boolean);
    return this.wonSaleService.listByOuvIds(ouvIds, user);
  }
}
