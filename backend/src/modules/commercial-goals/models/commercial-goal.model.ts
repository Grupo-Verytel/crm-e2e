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
import { User } from '../../auth/models/user.model';

@Table({
  tableName: 'commercial_goals',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class CommercialGoal extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'commercial_goal_id' })
  declare commercialGoalId: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.CHAR(36), field: 'user_id', allowNull: false })
  declare userId: string;

  @BelongsTo(() => User, { foreignKey: 'userId', as: 'commercial' })
  declare commercial?: User;

  @Column({ type: DataType.SMALLINT, field: 'fiscal_year', allowNull: false })
  declare fiscalYear: number;

  @Column({ type: DataType.TINYINT, allowNull: false })
  declare quarter: number;

  @Column({ type: DataType.CHAR(36), field: 'segment_id', allowNull: false })
  declare segmentId: string;

  @Column({
    type: DataType.DECIMAL(18, 0),
    field: 'amount_cop',
    allowNull: false,
  })
  declare amountCop: string;

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
