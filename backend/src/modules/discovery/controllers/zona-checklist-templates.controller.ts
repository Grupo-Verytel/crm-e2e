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
  ActualizarZonaChecklistTemplateDto,
  CrearZonaChecklistTemplateDto,
  ZonaChecklistTemplateResponseDto,
} from '../dtos/catalogo.dto';
import { CatalogosOuvService } from '../services/catalogos-ouv.service';

@Controller('admin/zona-checklist-templates')
export class ZonaChecklistTemplatesController {
  constructor(private readonly catalogos: CatalogosOuvService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'ZonaChecklistTemplate' })
  list(): Promise<ZonaChecklistTemplateResponseDto[]> {
    return this.catalogos.listTemplates();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'create', subject: 'ZonaChecklistTemplate' })
  create(
    @Body() dto: CrearZonaChecklistTemplateDto,
  ): Promise<ZonaChecklistTemplateResponseDto> {
    return this.catalogos.createTemplate(dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'update', subject: 'ZonaChecklistTemplate' })
  update(
    @Param('id') id: string,
    @Body() dto: ActualizarZonaChecklistTemplateDto,
  ): Promise<ZonaChecklistTemplateResponseDto> {
    return this.catalogos.updateTemplate(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'delete', subject: 'ZonaChecklistTemplate' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.catalogos.deleteTemplate(id);
  }
}
