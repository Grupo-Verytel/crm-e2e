import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import {
  ServiceDependency,
  ServiceName,
  ServiceOutcome,
  ServiceResultStatus,
} from '../domain/enums';
import { MepDeliverable } from './mep-deliverable.model';
import { MepResponseVersion } from './mep-response-version.model';

/**
 * §8 `mep_service_result` — fuente de verdad por servicio (AC-18).
 *
 * El CRM deriva de aquí sus campos de presentación; nunca al revés.
 * `outcome` es NULL mientras el `status` no sea COMPLETED.
 */
@Table({
  tableName: 'mep_service_result',
  timestamps: false,
  underscored: true,
})
export class MepServiceResult extends Model {
  @PrimaryKey
  @Column({ type: DataType.BIGINT, autoIncrement: true })
  declare id: string;

  @ForeignKey(() => MepResponseVersion)
  @Column({
    type: DataType.BIGINT,
    field: 'response_version_id',
    allowNull: false,
  })
  declare responseVersionId: string;

  @Column({
    type: DataType.ENUM(...Object.values(ServiceName)),
    allowNull: false,
  })
  declare service: ServiceName;

  @Column({
    type: DataType.ENUM(...Object.values(ServiceResultStatus)),
    allowNull: false,
  })
  declare status: ServiceResultStatus;

  @Column({
    type: DataType.ENUM(...Object.values(ServiceOutcome)),
    allowNull: true,
  })
  declare outcome: ServiceOutcome | null;

  @Column({
    type: DataType.ENUM(...Object.values(ServiceDependency)),
    allowNull: false,
  })
  declare dependency: ServiceDependency;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare summary: string | null;

  @Column({ type: DataType.STRING(64), field: 'reason_code', allowNull: true })
  declare reasonCode: string | null;

  @Column({ type: DataType.TINYINT, allowNull: false })
  declare position: number;

  @BelongsTo(() => MepResponseVersion)
  declare responseVersion: MepResponseVersion;

  @HasMany(() => MepDeliverable)
  declare deliverables: MepDeliverable[];
}
