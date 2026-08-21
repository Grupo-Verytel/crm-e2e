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
import {
  ActualizarMotivoCatalogoDto,
  CrearMotivoCatalogoDto,
  MotivoCatalogoResponseDto,
} from '../dtos/catalogo.dto';
import { CatalogosOuvService } from '../services/catalogos-ouv.service';

@Controller('admin/motivos-descarte')
export class MotivosDescarteController {
  constructor(private readonly catalogos: CatalogosOuvService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'MotivoDescarte' })
  list(): Promise<MotivoCatalogoResponseDto[]> {
    return this.catalogos.listMotivosDescarte();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'create', subject: 'MotivoDescarte' })
  create(
    @Body() dto: CrearMotivoCatalogoDto,
  ): Promise<MotivoCatalogoResponseDto> {
    return this.catalogos.createMotivoDescarte(dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'update', subject: 'MotivoDescarte' })
  update(
    @Param('id') id: string,
    @Body() dto: ActualizarMotivoCatalogoDto,
  ): Promise<MotivoCatalogoResponseDto> {
    return this.catalogos.updateMotivoDescarte(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'delete', subject: 'MotivoDescarte' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.catalogos.deleteMotivoDescarte(id);
  }
}
