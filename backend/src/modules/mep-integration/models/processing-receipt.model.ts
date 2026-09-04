import {
  BeforeDestroy,
  BeforeUpdate,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ProcessingStatus } from '../domain/enums';
import { CommercialInteraction } from './commercial-interaction.model';

/**
 * §8 `processing_receipt` — acuse técnico de MEP (pista técnica).
 *
 * INV-12: no sustituye al hito comercial `INTERACTION_RECEIVED`.
 * INV-13: el acuse no muta ninguna columna de la interacción comercial.
 * Append-only: sin UPDATE ni DELETE (también por permisos de BD, §8).
 * `semantic_fingerprint` es opaco: dato técnico, jamás campo comercial.
 */
@Table({
  tableName: 'processing_receipt',
  timestamps: true,
  updatedAt: false,
  underscored: true,
})
export class ProcessingReceipt extends Model {
  @PrimaryKey
  @Column({ type: DataType.BIGINT, autoIncrement: true })
  declare id: string;

  @ForeignKey(() => CommercialInteraction)
  @Column({ type: DataType.BIGINT, field: 'interaction_id', allowNull: false })
  declare interactionId: string;

  @Column({ type: DataType.STRING(128), field: 'receipt_id', allowNull: false })
  declare receiptId: string;

  @Column({
    type: DataType.INTEGER,
    field: 'receipt_version',
    allowNull: false,
  })
  declare receiptVersion: number;

  @Column({
    type: DataType.ENUM(...Object.values(ProcessingStatus)),
    field: 'processing_status',
    allowNull: false,
  })
  declare processingStatus: ProcessingStatus;

  @Column({
    type: DataType.STRING(128),
    field: 'correlation_id',
    allowNull: false,
  })
  declare correlationId: string;

  @Column({ type: DataType.DATE(3), field: 'observed_at', allowNull: false })
  declare observedAt: Date;

  @Column({
    type: DataType.STRING(32),
    field: 'adapter_version',
    allowNull: false,
  })
  declare adapterVersion: string;

  @Column({ type: DataType.STRING(64), field: 'reason_code', allowNull: true })
  declare reasonCode: string | null;

  @Column({
    type: DataType.CHAR(64),
    field: 'semantic_fingerprint',
    allowNull: false,
  })
  declare semanticFingerprint: string;

  @Column({ type: DataType.CHAR(64), field: 'payload_hash', allowNull: false })
  declare payloadHash: string;

  @Column({ type: DataType.STRING(96), allowNull: false })
  declare etag: string;

  @BelongsTo(() => CommercialInteraction)
  declare interaction: CommercialInteraction;

  @BeforeUpdate
  @BeforeDestroy
  static preventMutation(): never {
    throw new Error('processing_receipt is append-only');
  }
}
