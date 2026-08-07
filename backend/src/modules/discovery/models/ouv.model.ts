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
import { OuvResultado, OuvSegmento, OuvZona } from './enums/ouv.enums';

/**
 * Minimal OUV row for SQL→OUV conversion (spec-calificacion EARS-10..13 / R2).
 * Full funnel fields live in later discovery waves — do not add here.
 */
@Table({
  tableName: 'ouvs',
  timestamps: true,
  underscored: true,
})
export class Ouv extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'ouv_id' })
  declare ouvId: string;

  @Column({ type: DataType.STRING(20), allowNull: false, unique: true })
  declare consecutivo: string;

  @ForeignKey(() => Sql)
  @Column({
    type: DataType.CHAR(36),
    field: 'sql_id_origen',
    allowNull: false,
    unique: true,
  })
  declare sqlIdOrigen: string;

  @BelongsTo(() => Sql, { foreignKey: 'sqlIdOrigen', as: 'sqlOrigen' })
  declare sqlOrigen: Sql;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'comercial_id',
    allowNull: false,
  })
  declare comercialId: string;

  @BelongsTo(() => User, { foreignKey: 'comercialId', as: 'comercial' })
  declare comercial: User;

  @Column({ type: DataType.STRING(200), allowNull: false })
  declare titulo: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare descripcion: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(OuvSegmento)),
    allowNull: false,
  })
  declare segmento: OuvSegmento;

  @Column({ type: DataType.STRING(80), allowNull: false })
  declare vertical: string;

  @Default(OuvZona.Universo)
  @Column({
    type: DataType.ENUM(...Object.values(OuvZona)),
    field: 'zona_actual',
    allowNull: false,
  })
  declare zonaActual: OuvZona;

  @Default(OuvResultado.EnCurso)
  @Column({
    type: DataType.ENUM(...Object.values(OuvResultado)),
    allowNull: false,
  })
  declare resultado: OuvResultado;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;
}
