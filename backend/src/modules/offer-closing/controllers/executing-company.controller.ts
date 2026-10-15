import { Body, Controller, Get, Post } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  CreateExecutingCompanyDto,
  ExecutingCompanyListDto,
  ExecutingCompanyResponseDto,
} from '../dtos/executing-company.dto';
import { ExecutingCompanyService } from '../services/executing-company.service';

/**
 * Catálogos de uniones temporales y aliados que se asignan como empresa
 * ejecutora en el expediente de `/offers`. Solo SoporteComercial crea.
 */
@Controller('offer-closing')
export class ExecutingCompanyController {
  constructor(private readonly service: ExecutingCompanyService) {}

  @Get('joint-ventures')
  @CheckAbility({ action: 'read', subject: 'JointVenture' })
  listJointVentures(): Promise<ExecutingCompanyListDto> {
    return this.service.list('UT');
  }

  @Post('joint-ventures')
  @CheckAbility({ action: 'create', subject: 'JointVenture' })
  createJointVenture(
    @Body() dto: CreateExecutingCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExecutingCompanyResponseDto> {
    return this.service.create('UT', dto, user.userId);
  }

  @Get('partners')
  @CheckAbility({ action: 'read', subject: 'Partner' })
  listPartners(): Promise<ExecutingCompanyListDto> {
    return this.service.list('Aliado');
  }

  @Post('partners')
  @CheckAbility({ action: 'create', subject: 'Partner' })
  createPartner(
    @Body() dto: CreateExecutingCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExecutingCompanyResponseDto> {
    return this.service.create('Aliado', dto, user.userId);
  }
}
