import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Model, ModelStatic, Sequelize } from 'sequelize';
import { AuditAction } from '../models/audit-action.enum';
import { AuditWriterService } from './audit-writer.service';

const SKIPPED_AUDIT_FIELDS = new Set(['updated_at', 'updatedAt']);

/** Never persist credential material in audit_log. */
const SENSITIVE_AUDIT_FIELDS = new Set(['passwordHash', 'password_hash']);

@Injectable()
export class AuditHooksService implements OnModuleInit {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly auditWriterService: AuditWriterService,
  ) {}

  onModuleInit(): void {
    for (const model of Object.values(this.sequelize.models)) {
      if (this.shouldSkipModel(model)) {
        continue;
      }

      this.registerModelHooks(model);
    }
  }

  private shouldSkipModel(model: ModelStatic<Model>): boolean {
    const tableName = model.tableName ?? model.options?.tableName ?? model.name;

    // notifications are written by the workflow engine (own audit via STATE_CHANGE)
    return tableName === 'audit_log' || tableName === 'notifications';
  }

  private registerModelHooks(model: ModelStatic<Model>): void {
    model.addHook('afterCreate', async (instance: Model) => {
      await this.auditWriterService.write({
        tabla: this.getTableName(instance),
        registroId: this.getRegistroId(instance),
        accion: AuditAction.INSERT,
        valorAnterior: null,
        valorNuevo: this.serializeRecord(instance),
      });
    });

    model.addHook('afterUpdate', async (instance: Model) => {
      const changed = instance.changed();
      const changedFields = (Array.isArray(changed) ? changed : []).filter(
        (field) => !SKIPPED_AUDIT_FIELDS.has(field),
      );

      if (changedFields.length === 0) {
        return;
      }

      for (const field of changedFields) {
        await this.auditWriterService.write({
          tabla: this.getTableName(instance),
          registroId: this.getRegistroId(instance),
          accion: AuditAction.UPDATE,
          campoModificado: this.getFieldColumnName(instance, field),
          valorAnterior: this.serializeValue(instance.previous(field), field),
          valorNuevo: this.serializeValue(instance.get(field), field),
        });
      }
    });

    model.addHook('afterDestroy', async (instance: Model) => {
      await this.auditWriterService.write({
        tabla: this.getTableName(instance),
        registroId: this.getRegistroId(instance),
        accion: AuditAction.DELETE,
        valorAnterior: this.serializeRecord(instance),
        valorNuevo: null,
      });
    });
  }

  private getTableName(instance: Model): string {
    const model = instance.constructor as ModelStatic<Model>;
    return model.tableName ?? model.options?.tableName ?? model.name;
  }

  private getRegistroId(instance: Model): string {
    const model = instance.constructor as ModelStatic<Model>;
    const primaryKeyAttribute = model.primaryKeyAttribute;
    return String(instance.get(primaryKeyAttribute));
  }

  private getFieldColumnName(instance: Model, field: string): string {
    const model = instance.constructor as ModelStatic<Model>;
    const attribute = model.rawAttributes[field];
    return attribute?.field ?? field;
  }

  private serializeRecord(instance: Model): string {
    const plain = instance.toJSON() as Record<string, unknown>;
    for (const key of Object.keys(plain)) {
      if (SENSITIVE_AUDIT_FIELDS.has(key)) {
        plain[key] = '[redacted]';
      }
    }
    return JSON.stringify(plain);
  }

  private serializeValue(value: unknown, field?: string): string {
    if (field && SENSITIVE_AUDIT_FIELDS.has(field)) {
      return JSON.stringify('[redacted]');
    }
    return JSON.stringify(value ?? null);
  }
}
