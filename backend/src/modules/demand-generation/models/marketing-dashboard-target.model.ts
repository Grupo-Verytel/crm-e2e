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
import { MarketingDashboardMetric } from './enums/marketing-dashboard-metric.enum';

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

  @Column({ type: DataType.SMALLINT, field: 'fiscal_year', allowNull: false })
  declare fiscalYear: number;

  @Column({ type: DataType.TINYINT, allowNull: false })
  declare quarter: number;

  @Column({
    type: DataType.ENUM(...Object.values(MarketingDashboardMetric)),
    allowNull: false,
  })
  declare metric: MarketingDashboardMetric;

  @Column({
    type: DataType.INTEGER,
    field: 'weekly_target',
    allowNull: false,
  })
  declare weeklyTarget: number;

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
