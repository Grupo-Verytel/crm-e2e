import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  SaveWonSaleDto,
  WonSaleEnvelopeDto,
  WonSaleResponseDto,
} from '../dtos/won-sale.dto';
import { WonSaleService } from '../services/won-sale.service';

/** Expediente de cierre de la venta ganada — un registro por OUV. */
@Controller('offer-closing/ouvs/:ouvId/won-sale')
export class WonSaleController {
  constructor(private readonly wonSaleService: WonSaleService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'WonSale' })
  get(
    @Param('ouvId', ParseUUIDPipe) ouvId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WonSaleEnvelopeDto> {
    return this.wonSaleService.getByOuv(ouvId, user);
  }

  @Put()
  @CheckAbility({ action: 'update', subject: 'WonSale' })
  save(
    @Param('ouvId', ParseUUIDPipe) ouvId: string,
    @Body() dto: SaveWonSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WonSaleResponseDto> {
    return this.wonSaleService.save(ouvId, dto, user);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'delete', subject: 'WonSale' })
  remove(
    @Param('ouvId', ParseUUIDPipe) ouvId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.wonSaleService.remove(ouvId, user);
  }
}
