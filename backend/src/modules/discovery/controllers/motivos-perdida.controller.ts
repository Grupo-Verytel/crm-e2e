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

@Controller('admin/motivos-perdida')
export class MotivosPerdidaController {
  constructor(private readonly catalogos: CatalogosOuvService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'MotivoPerdida' })
  list(): Promise<MotivoCatalogoResponseDto[]> {
    return this.catalogos.listMotivosPerdida();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'create', subject: 'MotivoPerdida' })
  create(
    @Body() dto: CrearMotivoCatalogoDto,
  ): Promise<MotivoCatalogoResponseDto> {
    return this.catalogos.createMotivoPerdida(dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'update', subject: 'MotivoPerdida' })
  update(
    @Param('id') id: string,
    @Body() dto: ActualizarMotivoCatalogoDto,
  ): Promise<MotivoCatalogoResponseDto> {
    return this.catalogos.updateMotivoPerdida(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'delete', subject: 'MotivoPerdida' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.catalogos.deleteMotivoPerdida(id);
  }
}
