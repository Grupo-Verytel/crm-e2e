import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../auth/models/user.model';
import { OuvInteractionReply } from './ouv-interaction-reply.model';
import { Ouv } from './ouv.model';

/**
 * Bitácora de interacciones comerciales de una OUV.
 *
 * Cuelga de `ouv_id` (no de `lead_id`, como `demand_generation.interactions`)
 * para no atar la actividad post-conversión al lead original: la misma OUV
 * puede terminar con distintos leads a través del funnel y aquí lo que importa
 * es lo que el comercial hace sobre la oportunidad.
 */
@Table({
  tableName: 'ouv_interactions',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class OuvInteraction extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'ouv_interaction_id' })
  declare ouvInteractionId: string;

  @ForeignKey(() => Ouv)
  @Column({ type: DataType.CHAR(36), field: 'ouv_id', allowNull: false })
  declare ouvId: string;

  @BelongsTo(() => Ouv, { foreignKey: 'ouvId', as: 'ouv' })
  declare ouv: Ouv;

  @Column({ type: DataType.STRING(200), allowNull: false })
  declare titulo: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare observaciones: string | null;

  /** Etiquetas de sistema (cierre Perdida/Descartada); no las envía el cliente. */
  @Column({ type: DataType.JSON, allowNull: true })
  declare etiquetas: string[] | null;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'registrado_por_id',
    allowNull: false,
  })
  declare registradoPorId: string;

  @BelongsTo(() => User, {
    foreignKey: 'registradoPorId',
    as: 'registradoPor',
  })
  declare registradoPor: User;

  /**
   * Snapshot del nombre en el momento del registro. Se lee tal cual en la UI:
   * si el usuario cambia luego de nombre, la bitácora sigue mostrando quién
   * lo hizo entonces, no cómo se llama hoy.
   */
  @Column({
    type: DataType.STRING(160),
    field: 'registrado_por_nombre',
    allowNull: false,
  })
  declare registradoPorNombre: string;

  @Column({
    type: DataType.DATE(3),
    field: 'fecha_registrada',
    allowNull: false,
  })
  declare fechaRegistrada: Date;

  @HasMany(() => OuvInteractionReply, {
    foreignKey: 'ouvInteractionId',
    as: 'hilos',
  })
  declare hilos: OuvInteractionReply[];

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
