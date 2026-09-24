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
import { ReminderStatus } from './enums/reminder-status.enum';
import { Interaction } from './interaction.model';

@Table({
  tableName: 'reminders',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class Reminder extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'reminder_id' })
  declare reminderId: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.CHAR(36), field: 'user_id', allowNull: false })
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @ForeignKey(() => Interaction)
  @Column({
    type: DataType.CHAR(36),
    field: 'interaction_id',
    allowNull: true,
  })
  declare interactionId: string | null;

  @BelongsTo(() => Interaction)
  declare interaction: Interaction;

  @Column({ type: DataType.DATE, field: 'event_at', allowNull: false })
  declare eventAt: Date;

  @Column({
    type: DataType.INTEGER,
    field: 'remind_days_before',
    allowNull: false,
  })
  declare remindDaysBefore: number;

  @Column({ type: DataType.DATE, field: 'remind_at', allowNull: false })
  declare remindAt: Date;

  @Column({ type: DataType.STRING(500), allowNull: true })
  declare note: string | null;

  @Default(ReminderStatus.Pendiente)
  @Column({
    type: DataType.ENUM(...Object.values(ReminderStatus)),
    allowNull: false,
  })
  declare status: ReminderStatus;

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
