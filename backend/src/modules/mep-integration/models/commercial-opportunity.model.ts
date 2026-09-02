import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { OpportunityStatus } from '../domain/enums';

/**
 * §8 `commercial_opportunity` — OUV/oportunidad, autoridad total del CRM.
 *
 * INV-09: los nulos se preservan al serializar; nunca se omiten ni se
 * sustituyen por `""`, `0` o placeholders.
 * INV-11: `archetype_ref`/`archetype_name` son autoridad CRM. MEP no los
 * escribe por este contrato y no se equiparan con `Archetype_Lane`.
 */
@Table({
  tableName: 'commercial_opportunity',
  timestamps: true,
  createdAt: false,
  underscored: true,
})
export class CommercialOpportunity extends Model {
  @PrimaryKey
  @Column({ type: DataType.BIGINT, autoIncrement: true })
  declare id: string;

  @Column({
    type: DataType.STRING(64),
    field: 'crm_opportunity_ref',
    allowNull: false,
    unique: true,
  })
  declare crmOpportunityRef: string;

  @Column({ type: DataType.STRING(512), allowNull: true })
  declare title: string | null;

  @Column({
    type: DataType.STRING(64),
    field: 'organization_ref',
    allowNull: true,
  })
  declare organizationRef: string | null;

  @Column({
    type: DataType.STRING(512),
    field: 'organization_name',
    allowNull: true,
  })
  declare organizationName: string | null;

  @Column({
    type: DataType.BIGINT,
    field: 'commercial_amount',
    allowNull: true,
  })
  declare commercialAmount: string | null;

  @Column({
    type: DataType.CHAR(3),
    field: 'commercial_currency',
    allowNull: true,
  })
  declare commercialCurrency: string | null;

  @Column({ type: DataType.STRING(64), field: 'stage_ref', allowNull: true })
  declare stageRef: string | null;

  @Column({ type: DataType.STRING(256), field: 'stage_name', allowNull: true })
  declare stageName: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(OpportunityStatus)),
    allowNull: true,
  })
  declare status: OpportunityStatus | null;

  @Column({
    type: DataType.DATEONLY,
    field: 'expected_close_date',
    allowNull: true,
  })
  declare expectedCloseDate: string | null;

  @Column({
    type: DataType.STRING(64),
    field: 'commercial_owner_ref',
    allowNull: true,
  })
  declare commercialOwnerRef: string | null;

  @Column({
    type: DataType.STRING(256),
    field: 'commercial_owner_name',
    allowNull: true,
  })
  declare commercialOwnerName: string | null;

  @Column({
    type: DataType.STRING(64),
    field: 'archetype_ref',
    allowNull: true,
  })
  declare archetypeRef: string | null;

  @Column({
    type: DataType.STRING(256),
    field: 'archetype_name',
    allowNull: true,
  })
  declare archetypeName: string | null;

  @Column({
    type: DataType.STRING(32),
    field: 'source_version',
    allowNull: false,
  })
  declare sourceVersion: string;

  @Column({ type: DataType.STRING(96), allowNull: false })
  declare etag: string;
}
