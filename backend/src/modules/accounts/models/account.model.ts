import {
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { Person } from './person.model';

@Table({
  tableName: 'accounts',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class Account extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'account_id' })
  declare accountId: string;

  @Column({ type: DataType.STRING(160), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(20), field: 'tax_id', allowNull: true })
  declare taxId: string | null;

  @HasMany(() => Person, { foreignKey: 'accountId', as: 'people' })
  declare people: Person[];

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
