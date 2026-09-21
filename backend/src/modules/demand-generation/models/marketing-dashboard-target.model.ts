import {
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { MarketingDashboardPeriodType } from './enums/marketing-dashboard-period-type.enum';

@Table({
  tableName: 'marketing_dashboard_targets',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class MarketingDashboardTarget extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'target_id' })
  declare targetId: string;

  @Column({
    type: DataType.ENUM(...Object.values(MarketingDashboardPeriodType)),
    allowNull: false,
    unique: true,
    field: 'period_type',
  })
  declare periodType: MarketingDashboardPeriodType;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'interactions' })
  declare interactions: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'period_leads' })
  declare periodLeads: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'converted_ouvs' })
  declare convertedOuvs: number;

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
