import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { User } from './user.model';

@Table({
  tableName: 'refresh_tokens',
  timestamps: false,
})
export class RefreshToken extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'token_id' })
  declare tokenId: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.CHAR(36), field: 'user_id', allowNull: false })
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @Column({ type: DataType.STRING(255), field: 'token_hash', allowNull: false })
  declare tokenHash: string;

  @Column({ type: DataType.DATE, field: 'expires_at', allowNull: false })
  declare expiresAt: Date;

  @Column({ type: DataType.DATE, field: 'revoked_at', allowNull: true })
  declare revokedAt: Date | null;
}
