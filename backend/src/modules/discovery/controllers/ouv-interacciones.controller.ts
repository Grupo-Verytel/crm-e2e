import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CrearOuvInteraccionDto } from '../dtos/ouv-interaccion.dto';
import { OuvInteraccionResponseDto } from '../dtos/ouv-response.dto';
import { OuvInteraccionesService } from '../services/ouv-interacciones.service';

/**
 * Bitácora de interacciones de una OUV — pestaña «Interacciones» del detalle.
 *
 * Prefijo global `api/v1`, JWT + CASL con subject `Opportunity`, igual que el
 * resto de discovery. La autoría es del usuario autenticado; no la envía el
 * cliente.
 */
@Controller('discovery/ouvs/:ouvId/interacciones')
export class OuvInteraccionesController {
  constructor(private readonly interactions: OuvInteraccionesService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  list(
    @Param('ouvId') ouvId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvInteraccionResponseDto[]> {
    return this.interactions.listByOuv(ouvId, user.userId, user.roleName);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  crear(
    @Param('ouvId') ouvId: string,
    @Body() dto: CrearOuvInteraccionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvInteraccionResponseDto> {
    return this.interactions.crear(ouvId, dto, user.userId, user.roleName);
  }

  @Post(':ouvInteractionId/hilos')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  responder(
    @Param('ouvId') ouvId: string,
    @Param('ouvInteractionId') ouvInteractionId: string,
    @Body() dto: CrearOuvInteraccionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvInteraccionResponseDto> {
    return this.interactions.responder(
      ouvId,
      ouvInteractionId,
      dto,
      user.userId,
      user.roleName,
    );
  }

  @Delete(':ouvInteractionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async eliminar(
    @Param('ouvId') ouvId: string,
    @Param('ouvInteractionId') ouvInteractionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.interactions.eliminar(
      ouvId,
      ouvInteractionId,
      user.userId,
      user.roleName,
    );
  }

  @Delete(':ouvInteractionId/hilos/:replyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async eliminarHilo(
    @Param('ouvId') ouvId: string,
    @Param('ouvInteractionId') ouvInteractionId: string,
    @Param('replyId') replyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.interactions.eliminarHilo(
      ouvId,
      ouvInteractionId,
      replyId,
      user.userId,
      user.roleName,
    );
  }
}
