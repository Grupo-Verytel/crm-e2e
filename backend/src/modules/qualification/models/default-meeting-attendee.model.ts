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

@Table({
  tableName: 'default_meeting_attendees',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class DefaultMeetingAttendee extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({
    type: DataType.CHAR(36),
    field: 'default_meeting_attendee_id',
  })
  declare defaultMeetingAttendeeId: string;

  @Column({ type: DataType.STRING(180), allowNull: false })
  declare email: string;

  @Column({ type: DataType.STRING(120), allowNull: true })
  declare name: string | null;

  @Column({ type: DataType.INTEGER, field: 'sort_order', allowNull: false })
  declare sortOrder: number;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, field: 'is_active', allowNull: false })
  declare isActive: boolean;

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
