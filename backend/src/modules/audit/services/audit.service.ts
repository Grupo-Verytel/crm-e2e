import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { AuditLog } from '../models';
import { AuditLogQueryDto } from '../dtos/audit-log-query.dto';
import {
  AuditLogResponseDto,
  PaginatedAuditLogResponseDto,
} from '../dtos/audit-log-response.dto';
import { RecordSecurityEventDto } from '../dtos/record-security-event.dto';
import { AuditWriterService } from './audit-writer.service';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog) private readonly auditLogModel: typeof AuditLog,
    private readonly auditWriterService: AuditWriterService,
  ) {}

  async findAll(query: AuditLogQueryDto): Promise<PaginatedAuditLogResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const where = this.buildWhereClause(query);

    const { rows, count } = await this.auditLogModel.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows.map((row) => this.toResponseDto(row)),
      total: count,
      page,
      limit,
    };
  }

  async recordSecurityEvent(dto: RecordSecurityEventDto): Promise<void> {
    await this.auditWriterService.write({
      tabla: dto.tabla,
      registroId: dto.registro_id,
      accion: dto.accion,
      campoModificado: dto.campo_modificado ?? null,
      valorAnterior: dto.valor_anterior ?? null,
      valorNuevo: dto.valor_nuevo ?? null,
      contexto: dto.contexto ?? null,
    });
  }

  private buildWhereClause(query: AuditLogQueryDto): WhereOptions<AuditLog> {
    const where: WhereOptions<AuditLog> = {};

    if (query.tabla) {
      where.tabla = query.tabla;
    }

    if (query.registro_id) {
      where.registroId = query.registro_id;
    }

    if (query.usuario_id) {
      where.usuarioId = query.usuario_id;
    }

    if (query.accion) {
      where.accion = query.accion;
    }

    if (query.from || query.to) {
      const timestampFilter: Record<symbol, Date> = {};

      if (query.from) {
        timestampFilter[Op.gte] = new Date(query.from);
      }

      if (query.to) {
        timestampFilter[Op.lte] = new Date(query.to);
      }

      where.timestamp = timestampFilter;
    }

    return where;
  }

  private toResponseDto(auditLog: AuditLog): AuditLogResponseDto {
    return {
      audit_id: auditLog.auditId,
      tabla: auditLog.tabla,
      registro_id: auditLog.registroId,
      accion: auditLog.accion,
      campo_modificado: auditLog.campoModificado,
      valor_anterior: auditLog.valorAnterior,
      valor_nuevo: auditLog.valorNuevo,
      usuario_id: auditLog.usuarioId,
      ip_address: auditLog.ipAddress,
      user_agent: auditLog.userAgent,
      timestamp: auditLog.timestamp,
      contexto: auditLog.contexto,
    };
  }
}
