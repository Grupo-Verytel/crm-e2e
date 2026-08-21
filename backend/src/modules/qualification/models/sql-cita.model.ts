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
import { Sql } from '../../demand-generation/models/sql.model';

@Table({
  tableName: 'sql_citas',
  timestamps: true,
  underscored: true,
  paranoid: false,
})
export class SqlCita extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'cita_id' })
  declare citaId: string;

  @ForeignKey(() => Sql)
  @Column({
    type: DataType.CHAR(36),
    field: 'sql_id',
    allowNull: false,
    unique: true,
  })
  declare sqlId: string;

  @BelongsTo(() => Sql)
  declare sql: Sql;

  @Column({ type: DataType.STRING(200), allowNull: false })
  declare lugar: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare fecha: string;

  @Column({ type: DataType.TIME, allowNull: false })
  declare hora: string;

  @Column({
    type: DataType.STRING(120),
    field: 'contacto_nombre',
    allowNull: false,
  })
  declare contactoNombre: string;

  @Column({
    type: DataType.STRING(100),
    field: 'contacto_cargo',
    allowNull: true,
  })
  declare contactoCargo: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare descripcion: string | null;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'agendada_por',
    allowNull: false,
  })
  declare agendadaPor: string;

  @BelongsTo(() => User, { foreignKey: 'agendadaPor', as: 'agendador' })
  declare agendador: User;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;
}
