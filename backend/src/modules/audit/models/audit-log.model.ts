import {
  BeforeDestroy,
  BeforeUpdate,
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { AuditAction } from './audit-action.enum';

@Table({
  tableName: 'audit_log',
  timestamps: false,
  updatedAt: false,
  createdAt: false,
})
export class AuditLog extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'audit_id' })
  declare auditId: string;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare tabla: string;

  @Column({ type: DataType.CHAR(36), field: 'registro_id', allowNull: false })
  declare registroId: string;

  @Column({
    type: DataType.ENUM(...Object.values(AuditAction)),
    allowNull: false,
  })
  declare accion: AuditAction;

  @Column({
    type: DataType.STRING(80),
    field: 'campo_modificado',
    allowNull: true,
  })
  declare campoModificado: string | null;

  @Column({ type: DataType.TEXT, field: 'valor_anterior', allowNull: true })
  declare valorAnterior: string | null;

  @Column({ type: DataType.TEXT, field: 'valor_nuevo', allowNull: true })
  declare valorNuevo: string | null;

  @Column({ type: DataType.CHAR(36), field: 'usuario_id', allowNull: false })
  declare usuarioId: string;

  @Column({ type: DataType.STRING(45), field: 'ip_address', allowNull: false })
  declare ipAddress: string;

  @Column({ type: DataType.TEXT, field: 'user_agent', allowNull: true })
  declare userAgent: string | null;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, allowNull: false })
  declare timestamp: Date;

  @Column({ type: DataType.JSON, allowNull: true })
  declare contexto: Record<string, unknown> | null;

  @BeforeUpdate
  @BeforeDestroy
  static preventMutation(): void {
    throw new Error('audit_log is append-only');
  }
}
