import {
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { EntityType } from '../enums/entity-type.enum';

/**
 * Append-only funnel/status timeline for LEAD, SQL, OUV (and later PRE/PRI/SER).
 * Matches the existing `crm_e2e.status_history` table.
 */
@Table({
  tableName: 'status_history',
  timestamps: false,
  underscored: true,
})
export class StatusHistory extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'history_id' })
  declare historyId: string;

  @Column({
    type: DataType.STRING(32),
    field: 'entity_type',
    allowNull: false,
  })
  declare entityType: EntityType | string;

  @Column({ type: DataType.CHAR(36), field: 'entity_id', allowNull: false })
  declare entityId: string;

  @Column({
    type: DataType.CHAR(36),
    field: 'root_lead_id',
    allowNull: true,
  })
  declare rootLeadId: string | null;

  @Column({
    type: DataType.STRING(64),
    field: 'from_estado',
    allowNull: true,
  })
  declare fromEstado: string | null;

  @Column({
    type: DataType.STRING(64),
    field: 'to_estado',
    allowNull: false,
  })
  declare toEstado: string;

  @Column({ type: DataType.STRING(32), allowNull: false })
  declare trigger: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare motivo: string | null;

  @Column({ type: DataType.CHAR(36), field: 'changed_by', allowNull: true })
  declare changedBy: string | null;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE(3), field: 'changed_at', allowNull: false })
  declare changedAt: Date;

  @Column({ type: DataType.JSON, allowNull: true })
  declare metadata: Record<string, unknown> | null;
}
