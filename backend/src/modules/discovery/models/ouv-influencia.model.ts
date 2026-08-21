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
import { InfluenciaEstado, InfluenciaTipo } from './enums/ouv.enums';
import { OuvContacto } from './ouv-contacto.model';
import { Ouv } from './ouv.model';

@Table({
  tableName: 'ouv_influencias',
  timestamps: true,
  updatedAt: false,
  underscored: true,
})
export class OuvInfluencia extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'influencia_id' })
  declare influenciaId: string;

  @ForeignKey(() => Ouv)
  @Column({ type: DataType.CHAR(36), field: 'ouv_id', allowNull: false })
  declare ouvId: string;

  @BelongsTo(() => Ouv, { foreignKey: 'ouvId', as: 'ouv' })
  declare ouv: Ouv;

  @Column({
    type: DataType.ENUM(...Object.values(InfluenciaTipo)),
    allowNull: false,
  })
  declare tipo: InfluenciaTipo;

  @Default(InfluenciaEstado.SinEvaluar)
  @Column({
    type: DataType.ENUM(...Object.values(InfluenciaEstado)),
    allowNull: false,
  })
  declare estado: InfluenciaEstado;

  @ForeignKey(() => OuvContacto)
  @Column({
    type: DataType.CHAR(36),
    field: 'contacto_ouv_id',
    allowNull: true,
  })
  declare contactoOuvId: string | null;

  @BelongsTo(() => OuvContacto, {
    foreignKey: 'contactoOuvId',
    as: 'contacto',
  })
  declare contacto: OuvContacto | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notas: string | null;

  @Column({ type: DataType.TEXT, field: 'motivo_estado', allowNull: true })
  declare motivoEstado: string | null;

  @Column({
    type: DataType.DATE,
    field: 'fecha_ultimo_cambio',
    allowNull: true,
  })
  declare fechaUltimoCambio: Date | null;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;
}
