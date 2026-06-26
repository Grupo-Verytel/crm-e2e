import {
  BelongsTo,
  Column,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Role } from './role.model';

@Table({
  tableName: 'users',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'user_id' })
  declare userId: string;

  @Column({ type: DataType.STRING(180), allowNull: false, unique: true })
  declare email: string;

  @Column({ type: DataType.STRING(255), field: 'password_hash', allowNull: false })
  declare passwordHash: string;

  @Column({ type: DataType.STRING(120), field: 'full_name', allowNull: false })
  declare fullName: string;

  @ForeignKey(() => Role)
  @Column({ type: DataType.CHAR(36), field: 'role_id', allowNull: false })
  declare roleId: string;

  @BelongsTo(() => Role)
  declare role: Role;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, field: 'is_active', allowNull: false })
  declare isActive: boolean;

  @Default(0)
  @Column({
    type: DataType.SMALLINT,
    field: 'failed_login_attempts',
    allowNull: false,
  })
  declare failedLoginAttempts: number;

  @Column({ type: DataType.DATE, field: 'locked_until', allowNull: true })
  declare lockedUntil: Date | null;

  @Column({ type: DataType.DATE, field: 'last_login_at', allowNull: true })
  declare lastLoginAt: Date | null;

  @DeletedAt
  @Column({ type: DataType.DATE, field: 'deleted_at' })
  declare deletedAt: Date | null;
}
