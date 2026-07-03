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
import {
  CampaignEstado,
  CampaignObjetivo,
  CampaignTipo,
} from './enums/campaign.enums';
import { SegmentoObjetivo } from './enums/segment.enum';

@Table({
  tableName: 'campaigns',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class Campaign extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'campana_id' })
  declare campanaId: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare nombre: string;

  @Column({
    type: DataType.ENUM(...Object.values(CampaignTipo)),
    allowNull: false,
  })
  declare tipo: CampaignTipo;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare canal: string;

  @Column({
    type: DataType.ENUM(...Object.values(CampaignObjetivo)),
    allowNull: false,
  })
  declare objetivo: CampaignObjetivo;

  @Column({
    type: DataType.ENUM(...Object.values(SegmentoObjetivo)),
    field: 'segmento_objetivo',
    allowNull: false,
  })
  declare segmentoObjetivo: SegmentoObjetivo;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'responsable_id',
    allowNull: false,
  })
  declare responsableId: string;

  @BelongsTo(() => User, { foreignKey: 'responsableId', as: 'responsable' })
  declare responsable: User;

  @Column({ type: DataType.DATEONLY, field: 'fecha_inicio', allowNull: false })
  declare fechaInicio: string;

  @Column({ type: DataType.DATEONLY, field: 'fecha_fin', allowNull: false })
  declare fechaFin: string;

  @Column({
    type: DataType.DECIMAL(14, 2),
    allowNull: true,
    validate: { min: 0 },
  })
  declare presupuesto: string | null;

  @Column({
    type: DataType.DECIMAL(14, 2),
    field: 'gasto_real',
    allowNull: true,
    validate: { min: 0 },
  })
  declare gastoReal: string | null;

  @Default(CampaignEstado.Borrador)
  @Column({
    type: DataType.ENUM(...Object.values(CampaignEstado)),
    allowNull: false,
  })
  declare estado: CampaignEstado;

  /** Derived — updated by service when leads are linked; not user-editable. */
  @Default(0)
  @Column({
    type: DataType.INTEGER,
    field: 'leads_generados',
    allowNull: false,
  })
  declare leadsGenerados: number;

  /** Derived — gasto_real / leads_generados; not user-editable. */
  @Column({
    type: DataType.DECIMAL(14, 2),
    allowNull: true,
  })
  declare cpl: string | null;

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
