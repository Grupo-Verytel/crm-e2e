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
import { OuvInteraction } from '../../discovery/models/ouv-interaction.model';
import { OutlookSyncStatus } from './enums/outlook-sync-status.enum';
import { ReminderStatus } from './enums/reminder-status.enum';
import { Interaction } from './interaction.model';

/** Exactly one of interaction_id / ouv_interaction_id. Mirrors chk_reminders_single_source. */
export function assertSingleReminderSource(
  interactionId: string | null | undefined,
  ouvInteractionId: string | null | undefined,
): void {
  const hasInteraction = interactionId != null && interactionId !== '';
  const hasOuvInteraction =
    ouvInteractionId != null && ouvInteractionId !== '';
  if (hasInteraction === hasOuvInteraction) {
    throw new Error(
      'A reminder must reference exactly one source: interaction_id or ouv_interaction_id',
    );
  }
}

@Table({
  tableName: 'reminders',
  paranoid: true,
  timestamps: true,
  underscored: true,
  validate: {
    singleSource() {
      assertSingleReminderSource(this.interactionId, this.ouvInteractionId);
    },
  },
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

  @ForeignKey(() => OuvInteraction)
  @Column({
    type: DataType.CHAR(36),
    field: 'ouv_interaction_id',
    allowNull: true,
  })
  declare ouvInteractionId: string | null;

  @BelongsTo(() => OuvInteraction, { foreignKey: 'ouvInteractionId' })
  declare ouvInteraction: OuvInteraction;

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

  @Column({ type: DataType.DATE, field: 'completed_at', allowNull: true })
  declare completedAt: Date | null;

  @Column({
    type: DataType.STRING(255),
    field: 'outlook_event_id',
    allowNull: true,
  })
  declare outlookEventId: string | null;

  @Default(OutlookSyncStatus.NotRequired)
  @Column({
    type: DataType.ENUM(...Object.values(OutlookSyncStatus)),
    field: 'outlook_sync_status',
    allowNull: false,
  })
  declare outlookSyncStatus: OutlookSyncStatus;

  @Default(0)
  @Column({
    type: DataType.INTEGER,
    field: 'outlook_sync_attempts',
    allowNull: false,
  })
  declare outlookSyncAttempts: number;

  @Column({ type: DataType.DATE, field: 'outlook_synced_at', allowNull: true })
  declare outlookSyncedAt: Date | null;

  @Column({
    type: DataType.STRING(500),
    field: 'outlook_last_error',
    allowNull: true,
  })
  declare outlookLastError: string | null;

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
