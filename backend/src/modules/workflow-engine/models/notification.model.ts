import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { User } from '../../auth/models/user.model';
import { EntityType } from '../enums/entity-type.enum';

/**
 * In-app notification row written by the workflow engine
 * (spec-workflow-engine.md v1.1 §3.1).
 */
@Table({
  tableName: 'notifications',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  paranoid: false,
})
export class Notification extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'notification_id' })
  declare notificationId: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'recipient_user_id',
    allowNull: false,
  })
  declare recipientUserId: string;

  @BelongsTo(() => User, {
    foreignKey: 'recipientUserId',
    as: 'recipient',
  })
  declare recipient: User;

  @Column({
    type: DataType.STRING(60),
    field: 'event_type',
    allowNull: false,
  })
  declare eventType: string;

  @Column({
    type: DataType.ENUM(...Object.values(EntityType)),
    field: 'entity_type',
    allowNull: false,
  })
  declare entityType: EntityType;

  @Column({ type: DataType.CHAR(36), field: 'entity_id', allowNull: false })
  declare entityId: string;

  @Column({
    type: DataType.STRING(160),
    field: 'entity_label',
    allowNull: false,
  })
  declare entityLabel: string;

  @Column({
    type: DataType.STRING(40),
    field: 'estado_anterior',
    allowNull: true,
  })
  declare estadoAnterior: string | null;

  @Column({
    type: DataType.STRING(40),
    field: 'estado_nuevo',
    allowNull: false,
  })
  declare estadoNuevo: string;

  @Column({ type: DataType.STRING(160), allowNull: false })
  declare titulo: string;

  @Column({ type: DataType.STRING(400), allowNull: false })
  declare mensaje: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'actor_user_id',
    allowNull: true,
  })
  declare actorUserId: string | null;

  @BelongsTo(() => User, {
    foreignKey: 'actorUserId',
    as: 'actor',
  })
  declare actor: User | null;

  @Column({ type: DataType.JSON, allowNull: true })
  declare metadata: Record<string, unknown> | null;

  @Column({
    type: DataType.STRING(180),
    field: 'dedup_key',
    allowNull: true,
  })
  declare dedupKey: string | null;

  @Column({ type: DataType.DATE, field: 'read_at', allowNull: true })
  declare readAt: Date | null;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;
}
