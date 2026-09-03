import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { MepServiceResult } from './mep-service-result.model';

/**
 * §8 `mep_deliverable` — entregable por servicio.
 *
 * INV-23: la `url` es siempre de SharePoint **Documents**. El registro de
 * SharePoint List nunca es entregable (se rechaza en validación con
 * 422 DELIVERABLE_NOT_A_DOCUMENT).
 */
@Table({
  tableName: 'mep_deliverable',
  timestamps: false,
  underscored: true,
})
export class MepDeliverable extends Model {
  @PrimaryKey
  @Column({ type: DataType.BIGINT, autoIncrement: true })
  declare id: string;

  @ForeignKey(() => MepServiceResult)
  @Column({
    type: DataType.BIGINT,
    field: 'service_result_id',
    allowNull: false,
  })
  declare serviceResultId: string;

  @Column({ type: DataType.STRING(1024), allowNull: false })
  declare url: string;

  @Column({ type: DataType.STRING(256), allowNull: true })
  declare label: string | null;

  @Column({ type: DataType.DATE(3), field: 'published_at', allowNull: true })
  declare publishedAt: Date | null;

  @BelongsTo(() => MepServiceResult)
  declare serviceResult: MepServiceResult;
}
