import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  ActualizarOuvContactoDto,
  CrearOuvContactoDto,
} from '../dtos/ouv-contacto.dto';
import { OuvContactoResponseDto } from '../dtos/ouv-response.dto';
import { OuvContactosService } from '../services/ouv-contactos.service';

@Controller('discovery/ouvs/:ouvId/contactos')
export class OuvContactosController {
  constructor(private readonly contactosService: OuvContactosService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  async list(
    @Param('ouvId') ouvId: string,
  ): Promise<OuvContactoResponseDto[]> {
    return this.contactosService.listByOuv(ouvId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async crear(
    @Param('ouvId') ouvId: string,
    @Body() dto: CrearOuvContactoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvContactoResponseDto> {
    return this.contactosService.crear(ouvId, dto, user.userId, user.roleName);
  }

  @Patch(':contactoOuvId')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async actualizar(
    @Param('contactoOuvId') contactoOuvId: string,
    @Body() dto: ActualizarOuvContactoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvContactoResponseDto> {
    return this.contactosService.actualizarNotas(
      contactoOuvId,
      dto,
      user.userId,
      user.roleName,
    );
  }

  @Delete(':contactoOuvId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async eliminar(
    @Param('contactoOuvId') contactoOuvId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.contactosService.eliminar(
      contactoOuvId,
      user.userId,
      user.roleName,
    );
  }
}
