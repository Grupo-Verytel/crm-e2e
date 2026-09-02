import {
  Column,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ServiceHorizon } from '../domain/enums';
import { InteractionRequestedService } from './interaction-requested-service.model';

/**
 * §8 `commercial_interaction` — interacción comercial, autoridad CRM.
 *
 * P-07 / INV-07: `source_content` es intocable; ninguna ruta de esta
 * integración lo actualiza (además hay trigger BEFORE UPDATE en la migración).
 * INV-06: esta tabla no tiene ni tendrá `interaction_type`.
 */
@Table({
  tableName: 'commercial_interaction',
  timestamps: true,
  underscored: true,
})
export class CommercialInteraction extends Model {
  @PrimaryKey
  @Column({ type: DataType.BIGINT, autoIncrement: true })
  declare id: string;

  @Column({
    type: DataType.STRING(64),
    field: 'crm_interaction_ref',
    allowNull: false,
    unique: true,
  })
  declare crmInteractionRef: string;

  @Column({
    type: DataType.STRING(64),
    field: 'crm_opportunity_ref',
    allowNull: true,
  })
  declare crmOpportunityRef: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(ServiceHorizon)),
    field: 'service_horizon',
    allowNull: false,
  })
  declare serviceHorizon: ServiceHorizon;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare subject: string | null;

  @Column({
    type: DataType.TEXT('medium'),
    field: 'source_content',
    allowNull: false,
  })
  declare sourceContent: string;

  @Column({
    type: DataType.DATE(3),
    field: 'source_created_at',
    allowNull: false,
  })
  declare sourceCreatedAt: Date;

  @Column({
    type: DataType.STRING(32),
    field: 'source_version',
    allowNull: false,
  })
  declare sourceVersion: string;

  @Column({ type: DataType.STRING(96), allowNull: false })
  declare etag: string;

  @Default(true)
  @Column({
    type: DataType.BOOLEAN,
    field: 'eligible_for_mep',
    allowNull: false,
  })
  declare eligibleForMep: boolean;

  @HasMany(() => InteractionRequestedService)
  declare requestedServices: InteractionRequestedService[];
}
