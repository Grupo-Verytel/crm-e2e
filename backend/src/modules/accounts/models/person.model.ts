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
import { Account } from './account.model';

@Table({
  tableName: 'people',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class Person extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'person_id' })
  declare personId: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(80), field: 'job_title', allowNull: true })
  declare jobTitle: string | null;

  @Column({ type: DataType.STRING(180), allowNull: true })
  declare email: string | null;

  @Column({ type: DataType.STRING(20), allowNull: true })
  declare phone: string | null;

  @ForeignKey(() => Account)
  @Column({
    type: DataType.CHAR(36),
    field: 'account_id',
    allowNull: false,
  })
  declare accountId: string;

  @BelongsTo(() => Account, { foreignKey: 'accountId', as: 'account' })
  declare account: Account;

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
