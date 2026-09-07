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
  KickoffEnvelopeDto,
  KickoffResponseDto,
  SaveKickoffDto,
} from '../dtos/kickoff.dto';
import { KickoffService } from '../services/kickoff.service';

/** Kickoff de la venta ganada — un registro por OUV. */
@Controller('offer-closing/ouvs/:ouvId/kickoff')
export class KickoffController {
  constructor(private readonly kickoffService: KickoffService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Kickoff' })
  get(
    @Param('ouvId', ParseUUIDPipe) ouvId: string,
  ): Promise<KickoffEnvelopeDto> {
    return this.kickoffService.getByOuv(ouvId);
  }

  @Put()
  @CheckAbility({ action: 'update', subject: 'Kickoff' })
  save(
    @Param('ouvId', ParseUUIDPipe) ouvId: string,
    @Body() dto: SaveKickoffDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<KickoffResponseDto> {
    return this.kickoffService.save(ouvId, dto, user?.userId ?? null);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'delete', subject: 'Kickoff' })
  remove(@Param('ouvId', ParseUUIDPipe) ouvId: string): Promise<void> {
    return this.kickoffService.remove(ouvId);
  }
}
