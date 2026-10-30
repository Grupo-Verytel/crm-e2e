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
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../auth/models/user.model';
import { SqlCita } from './sql-cita.model';

export enum SqlCitaAttendeeSource {
  Default = 'default',
  Manual = 'manual',
}

/**
 * Snapshot copied when a SQL cita is scheduled.
 * Not paranoid: cancelling the cita hard-deletes sql_citas and the FK
 * cascades. This is an explicit exception to the usual deleted_at rule.
 */
@Table({
  tableName: 'sql_cita_attendees',
  paranoid: false,
  timestamps: true,
  underscored: true,
})
export class SqlCitaAttendee extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'sql_cita_attendee_id' })
  declare sqlCitaAttendeeId: string;

  @ForeignKey(() => SqlCita)
  @Column({ type: DataType.CHAR(36), field: 'cita_id', allowNull: false })
  declare citaId: string;

  @BelongsTo(() => SqlCita)
  declare cita?: SqlCita;

  @Column({ type: DataType.STRING(180), allowNull: false })
  declare email: string;

  @Column({ type: DataType.STRING(120), allowNull: true })
  declare name: string | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.CHAR(36), field: 'user_id', allowNull: true })
  declare userId: string | null;

  @BelongsTo(() => User)
  declare user?: User;

  @Column({
    type: DataType.ENUM(...Object.values(SqlCitaAttendeeSource)),
    allowNull: false,
  })
  declare source: SqlCitaAttendeeSource;

  @Column({ type: DataType.INTEGER, field: 'sort_order', allowNull: false })
  declare sortOrder: number;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;
}
