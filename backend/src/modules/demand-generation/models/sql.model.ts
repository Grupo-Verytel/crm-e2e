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
import { User } from '../../auth/models/user.model';
import { Mql } from './mql.model';

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

  @Default(true)
  @Column({ type: DataType.BOOLEAN, field: 'en_backlog', allowNull: false })
  declare enBacklog: boolean;

  /** Assigned later by Soporte Comercial — outside this module's scope. */
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

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, field: 'fecha_creacion', allowNull: false })
  declare fechaCreacion: Date;

  @DeletedAt
  @Column({ type: DataType.DATE, field: 'deleted_at' })
  declare deletedAt: Date | null;
}
