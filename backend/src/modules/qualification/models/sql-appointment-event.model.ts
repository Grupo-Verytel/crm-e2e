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
import { Sql } from '../../demand-generation/models/sql.model';
import { SqlCitaEstado } from './enums/sql-cita-estado.enum';

export type SqlAppointmentEventPayload = {
  fecha?: string;
  hora?: string;
  fecha_anterior?: string;
  hora_anterior?: string;
};

@Table({
  tableName: 'sql_appointment_events',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class SqlAppointmentEvent extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'sql_appointment_event_id' })
  declare sqlAppointmentEventId: string;

  @ForeignKey(() => Sql)
  @Column({ type: DataType.CHAR(36), field: 'sql_id', allowNull: false })
  declare sqlId: string;

  @BelongsTo(() => Sql)
  declare sql: Sql;

  @Column({
    type: DataType.ENUM(...Object.values(SqlCitaEstado)),
    field: 'event_type',
    allowNull: false,
  })
  declare eventType: SqlCitaEstado;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, field: 'occurred_at', allowNull: false })
  declare occurredAt: Date;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'actor_user_id',
    allowNull: false,
  })
  declare actorUserId: string;

  @BelongsTo(() => User, { foreignKey: 'actorUserId', as: 'actor' })
  declare actor: User;

  @Column({ type: DataType.JSON, allowNull: true })
  declare payload: SqlAppointmentEventPayload | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;

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
