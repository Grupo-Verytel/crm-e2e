import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditContextService } from '../context/audit-context.service';
import { SYSTEM_USER_ID } from '../constants/system-user.constants';
import { AuditLog } from '../models';
import { AuditWriteEntry } from './audit-write-entry.interface';

/**
 * Internal writer — the only code path allowed to INSERT into audit_log.
 * Not exported from AuditModule (EARS-AUDIT-11).
 */
@Injectable()
export class AuditWriterService {
  constructor(
    private readonly auditContextService: AuditContextService,
    private readonly configService: ConfigService,
  ) {}

  async write(entry: AuditWriteEntry): Promise<void> {
    const context = this.auditContextService.get() ?? {
      usuarioId:
        this.configService.get<string>('AUDIT_SYSTEM_USER_ID') ??
        SYSTEM_USER_ID,
      ipAddress: '0.0.0.0',
      userAgent: null,
    };

    await AuditLog.create({
      tabla: entry.tabla,
      registroId: entry.registroId,
      accion: entry.accion,
      campoModificado: entry.campoModificado ?? null,
      valorAnterior: entry.valorAnterior ?? null,
      valorNuevo: entry.valorNuevo ?? null,
      usuarioId: context.usuarioId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      contexto: entry.contexto ?? null,
    });
  }
}
