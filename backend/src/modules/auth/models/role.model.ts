import {
  Column,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { User } from './user.model';

@Table({
  tableName: 'roles',
  timestamps: false,
})
export class Role extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'role_id' })
  declare roleId: string;

  @Column({ type: DataType.STRING(60), allowNull: false, unique: true })
  declare name: string;

  @Column({ type: DataType.STRING(160), allowNull: true })
  declare description: string | null;

  @Column({ type: DataType.JSON, allowNull: false })
  declare permissions: Record<string, unknown>;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, field: 'is_system', allowNull: false })
  declare isSystem: boolean;

  @HasMany(() => User)
  declare users: User[];
}
