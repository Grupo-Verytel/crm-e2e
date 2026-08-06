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
import { Mql } from './mql.model';
import { SqlEstado } from './enums/sql.enums';

@Table({
  tableName: 'sqls',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class Sql extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'sql_id' })
  declare sqlId: string;

  @ForeignKey(() => Mql)
  @Column({
    type: DataType.CHAR(36),
    field: 'mql_id',
    allowNull: false,
    unique: true,
  })
  declare mqlId: string;

  @BelongsTo(() => Mql)
  declare mql: Mql;

  @Default(SqlEstado.PendienteAsignacion)
  @Column({
    type: DataType.ENUM(...Object.values(SqlEstado)),
    allowNull: false,
  })
  declare estado: SqlEstado;

  /**
   * Legacy flag kept in sync with estado for DG consumers.
   * true when PendienteAsignacion or Backlog; false otherwise.
   */
  @Default(true)
  @Column({ type: DataType.BOOLEAN, field: 'en_backlog', allowNull: false })
  declare enBacklog: boolean;

  /** Assigned by Profesional Soporte Comercial (qualification module). */
  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'comercial_asignado_id',
    allowNull: true,
  })
  declare comercialAsignadoId: string | null;

  @BelongsTo(() => User, {
    foreignKey: 'comercialAsignadoId',
    as: 'comercialAsignado',
  })
  declare comercialAsignado: User;

  @Column({ type: DataType.DATE, field: 'fecha_asignacion', allowNull: true })
  declare fechaAsignacion: Date | null;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, field: 'fecha_creacion', allowNull: false })
  declare fechaCreacion: Date;

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
