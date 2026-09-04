import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { Ouv } from '../../discovery/models/ouv.model';

/**
 * Inbound-only ledger of project state changes pushed by the PMO.
 * The status text is stored verbatim: the PMO owns the vocabulary and the
 * CRM neither validates the value nor the transition.
 */
@Table({
  tableName: 'project_status_events',
  timestamps: true,
  underscored: true,
  paranoid: true,
})
export class ProjectStatusEvent extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'project_status_event_id' })
  declare projectStatusEventId: string;

  /** `referenceId` in the PMO payload — correlation key with the OUV. */
  @ForeignKey(() => Ouv)
  @Column({ type: DataType.CHAR(36), field: 'ouv_id', allowNull: false })
  declare ouvId: string;

  @BelongsTo(() => Ouv, { foreignKey: 'ouvId', as: 'ouv' })
  declare ouv: Ouv;

  /** Idempotency key issued by the PMO — one per event, stable across retries. */
  @Column({
    type: DataType.CHAR(36),
    field: 'external_event_id',
    allowNull: false,
    unique: true,
  })
  declare externalEventId: string;

  @Column({ type: DataType.STRING(120), field: 'new_status', allowNull: false })
  declare newStatus: string;

  @Column({ type: DataType.DATE, field: 'occurred_at', allowNull: false })
  declare occurredAt: Date;

  @Column({ type: DataType.STRING(400), allowNull: true })
  declare comment: string | null;

  @Column({ type: DataType.DATE, field: 'received_at', allowNull: false })
  declare receivedAt: Date;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  @DeletedAt
  @Column({ type: DataType.DATE, field: 'deleted_at' })
  declare deletedAt: Date | null;
}
