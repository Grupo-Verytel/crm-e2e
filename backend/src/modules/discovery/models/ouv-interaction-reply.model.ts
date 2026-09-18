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
import { OuvInteraction } from './ouv-interaction.model';

/** Respuesta dentro del hilo de una interacción OUV. */
@Table({
  tableName: 'ouv_interaction_replies',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class OuvInteractionReply extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'ouv_interaction_reply_id' })
  declare ouvInteractionReplyId: string;

  @ForeignKey(() => OuvInteraction)
  @Column({
    type: DataType.CHAR(36),
    field: 'ouv_interaction_id',
    allowNull: false,
  })
  declare ouvInteractionId: string;

  @BelongsTo(() => OuvInteraction, {
    foreignKey: 'ouvInteractionId',
    as: 'interaction',
  })
  declare interaction: OuvInteraction;

  @Column({ type: DataType.STRING(200), allowNull: false })
  declare titulo: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare observaciones: string | null;

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
