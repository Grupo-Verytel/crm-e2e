import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type {
  ActualizarMotivoCatalogoDto,
  ActualizarZonaChecklistTemplateDto,
  CrearMotivoCatalogoDto,
  CrearZonaChecklistTemplateDto,
  MotivoCatalogoResponseDto,
  ZonaChecklistTemplateResponseDto,
} from '../dtos/catalogo.dto';
import { MotivoDescarte } from '../models/motivo-descarte.model';
import { MotivoPerdida } from '../models/motivo-perdida.model';
import { ZonaChecklistTemplate } from '../models/zona-checklist-template.model';

@Injectable()
export class CatalogosOuvService {
  constructor(
    @InjectModel(MotivoPerdida)
    private readonly motivoPerdidaModel: typeof MotivoPerdida,
    @InjectModel(MotivoDescarte)
    private readonly motivoDescarteModel: typeof MotivoDescarte,
    @InjectModel(ZonaChecklistTemplate)
    private readonly templateModel: typeof ZonaChecklistTemplate,
  ) {}

  // ── motivos_perdida ──────────────────────────────────────────────

  async listMotivosPerdida(): Promise<MotivoCatalogoResponseDto[]> {
    const rows = await this.motivoPerdidaModel.findAll({
      order: [['orden', 'ASC'], ['nombre', 'ASC']],
    });
    return rows.map((r) => this.toMotivo(r));
  }

  async createMotivoPerdida(
    dto: CrearMotivoCatalogoDto,
  ): Promise<MotivoCatalogoResponseDto> {
    const row = await this.motivoPerdidaModel.create({
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion?.trim() || null,
      requiereDetalle: dto.requiere_detalle ?? false,
      orden: dto.orden ?? 0,
    });
    return this.toMotivo(row);
  }

  async updateMotivoPerdida(
    id: string,
    dto: ActualizarMotivoCatalogoDto,
  ): Promise<MotivoCatalogoResponseDto> {
    const row = await this.motivoPerdidaModel.findByPk(id);
    if (!row) {
      throw new NotFoundException(`MotivoPerdida ${id} not found`);
    }
    await row.update({
      ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
      ...(dto.descripcion !== undefined
        ? { descripcion: dto.descripcion?.trim() || null }
        : {}),
      ...(dto.requiere_detalle !== undefined
        ? { requiereDetalle: dto.requiere_detalle }
        : {}),
      ...(dto.orden !== undefined ? { orden: dto.orden } : {}),
    });
    return this.toMotivo(row);
  }

  async deleteMotivoPerdida(id: string): Promise<void> {
    const row = await this.motivoPerdidaModel.findByPk(id);
    if (!row) {
      throw new NotFoundException(`MotivoPerdida ${id} not found`);
    }
    await row.destroy();
  }

  // ── motivos_descarte ─────────────────────────────────────────────

  async listMotivosDescarte(): Promise<MotivoCatalogoResponseDto[]> {
    const rows = await this.motivoDescarteModel.findAll({
      order: [['orden', 'ASC'], ['nombre', 'ASC']],
    });
    return rows.map((r) => this.toMotivo(r));
  }

  async createMotivoDescarte(
    dto: CrearMotivoCatalogoDto,
  ): Promise<MotivoCatalogoResponseDto> {
    const row = await this.motivoDescarteModel.create({
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion?.trim() || null,
      requiereDetalle: dto.requiere_detalle ?? false,
      orden: dto.orden ?? 0,
    });
    return this.toMotivo(row);
  }

  async updateMotivoDescarte(
    id: string,
    dto: ActualizarMotivoCatalogoDto,
  ): Promise<MotivoCatalogoResponseDto> {
    const row = await this.motivoDescarteModel.findByPk(id);
    if (!row) {
      throw new NotFoundException(`MotivoDescarte ${id} not found`);
    }
    await row.update({
      ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
      ...(dto.descripcion !== undefined
        ? { descripcion: dto.descripcion?.trim() || null }
        : {}),
      ...(dto.requiere_detalle !== undefined
        ? { requiereDetalle: dto.requiere_detalle }
        : {}),
      ...(dto.orden !== undefined ? { orden: dto.orden } : {}),
    });
    return this.toMotivo(row);
  }

  async deleteMotivoDescarte(id: string): Promise<void> {
    const row = await this.motivoDescarteModel.findByPk(id);
    if (!row) {
      throw new NotFoundException(`MotivoDescarte ${id} not found`);
    }
    await row.destroy();
  }

  // ── zona_checklist_templates ─────────────────────────────────────

  async listTemplates(): Promise<ZonaChecklistTemplateResponseDto[]> {
    const rows = await this.templateModel.findAll({
      order: [['zona', 'ASC'], ['orden', 'ASC']],
    });
    return rows.map((r) => this.toTemplate(r));
  }

  async createTemplate(
    dto: CrearZonaChecklistTemplateDto,
  ): Promise<ZonaChecklistTemplateResponseDto> {
    const row = await this.templateModel.create({
      zona: dto.zona,
      codigoItem: dto.codigo_item.trim(),
      label: dto.label.trim(),
      orden: dto.orden ?? 0,
    });
    return this.toTemplate(row);
  }

  async updateTemplate(
    id: string,
    dto: ActualizarZonaChecklistTemplateDto,
  ): Promise<ZonaChecklistTemplateResponseDto> {
    const row = await this.templateModel.findByPk(id);
    if (!row) {
      throw new NotFoundException(`ZonaChecklistTemplate ${id} not found`);
    }
    await row.update({
      ...(dto.zona !== undefined ? { zona: dto.zona } : {}),
      ...(dto.codigo_item !== undefined
        ? { codigoItem: dto.codigo_item.trim() }
        : {}),
      ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
      ...(dto.orden !== undefined ? { orden: dto.orden } : {}),
    });
    return this.toTemplate(row);
  }

  async deleteTemplate(id: string): Promise<void> {
    const row = await this.templateModel.findByPk(id);
    if (!row) {
      throw new NotFoundException(`ZonaChecklistTemplate ${id} not found`);
    }
    await row.destroy();
  }

  private toMotivo(
    row: MotivoPerdida | MotivoDescarte,
  ): MotivoCatalogoResponseDto {
    return {
      motivo_id: row.motivoId,
      nombre: row.nombre,
      descripcion: row.descripcion,
      requiere_detalle: row.requiereDetalle,
      orden: row.orden,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  private toTemplate(
    row: ZonaChecklistTemplate,
  ): ZonaChecklistTemplateResponseDto {
    return {
      template_id: row.templateId,
      zona: row.zona,
      codigo_item: row.codigoItem,
      label: row.label,
      orden: row.orden,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
}
