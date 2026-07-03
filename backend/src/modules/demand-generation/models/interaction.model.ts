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
import { Campaign } from './campaign.model';
import {
  InteractionCanal,
  InteractionResultado,
  InteractionTipo,
} from './enums/interaction.enums';
import { Lead } from './lead.model';

@Table({
  tableName: 'interactions',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class Interaction extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'interaction_id' })
  declare interactionId: string;

  @ForeignKey(() => Lead)
  @Column({ type: DataType.CHAR(36), field: 'lead_id', allowNull: false })
  declare leadId: string;

  @BelongsTo(() => Lead)
  declare lead: Lead;

  @Column({
    type: DataType.ENUM(...Object.values(InteractionTipo)),
    allowNull: false,
  })
  declare tipo: InteractionTipo;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare subtipo: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(InteractionCanal)),
    allowNull: false,
  })
  declare canal: InteractionCanal;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare descripcion: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(InteractionResultado)),
    allowNull: true,
  })
  declare resultado: InteractionResultado | null;

  @ForeignKey(() => Campaign)
  @Column({ type: DataType.CHAR(36), field: 'campana_id', allowNull: true })
  declare campanaId: string | null;

  @BelongsTo(() => Campaign)
  declare campana: Campaign;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'responsable_id',
    allowNull: false,
  })
  declare responsableId: string;

  @BelongsTo(() => User, { foreignKey: 'responsableId', as: 'responsable' })
  declare responsable: User;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, allowNull: false })
  declare fecha: Date;

  /** Wave 2 scoring — modeled but inactive (no calculation engine in v1). */
  @Column({ type: DataType.SMALLINT, field: 'puntos_scoring', allowNull: true })
  declare puntosScoring: number | null;

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
