import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ServiceDependency, ServiceName } from '../domain/enums';
import { CommercialInteraction } from './commercial-interaction.model';

/**
 * §8 `interaction_requested_service` — 1..2 servicios solicitados.
 *
 * INV-01: `TECHNICAL_DESIGN` siempre con `dependency = NONE`;
 * `FINANCIAL_DESIGN` puede depender del técnico, nunca al revés.
 * `position` conserva el orden de presentación del intake.
 */
@Table({
  tableName: 'interaction_requested_service',
  timestamps: false,
  underscored: true,
})
export class InteractionRequestedService extends Model {
  @PrimaryKey
  @Column({ type: DataType.BIGINT, autoIncrement: true })
  declare id: string;

  @ForeignKey(() => CommercialInteraction)
  @Column({ type: DataType.BIGINT, field: 'interaction_id', allowNull: false })
  declare interactionId: string;

  @Column({
    type: DataType.ENUM(...Object.values(ServiceName)),
    allowNull: false,
  })
  declare service: ServiceName;

  @Column({
    type: DataType.ENUM(...Object.values(ServiceDependency)),
    allowNull: false,
  })
  declare dependency: ServiceDependency;

  @Column({ type: DataType.TINYINT, allowNull: false })
  declare position: number;

  @BelongsTo(() => CommercialInteraction)
  declare interaction: CommercialInteraction;
}
