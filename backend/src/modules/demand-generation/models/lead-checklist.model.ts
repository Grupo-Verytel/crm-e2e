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
import { ChecklistResultado } from './enums/checklist.enums';
import { Lead } from './lead.model';

@Table({
  tableName: 'lead_checklist',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class LeadChecklist extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'checklist_id' })
  declare checklistId: string;

  @ForeignKey(() => Lead)
  @Column({ type: DataType.CHAR(36), field: 'lead_id', allowNull: false })
  declare leadId: string;

  @BelongsTo(() => Lead)
  declare lead: Lead;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    field: 'criterio_sector_objetivo',
    allowNull: false,
  })
  declare criterioSectorObjetivo: boolean;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    field: 'criterio_necesidad_portafolio',
    allowNull: false,
  })
  declare criterioNecesidadPortafolio: boolean;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    field: 'criterio_acceso_decisor',
    allowNull: false,
  })
  declare criterioAccesoDecisor: boolean;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    field: 'criterio_presupuesto_indicios',
    allowNull: false,
  })
  declare criterioPresupuestoIndicios: boolean;

  /**
   * Calculated in LeadChecklistService (never in DB) whenever any of the 4
   * booleans change — kept in the service layer for project-wide consistency.
   */
  @Default(ChecklistResultado.NoCalificado)
  @Column({
    type: DataType.ENUM(...Object.values(ChecklistResultado)),
    allowNull: false,
  })
  declare resultado: ChecklistResultado;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'completado_por',
    allowNull: false,
  })
  declare completadoPor: string;

  @BelongsTo(() => User, { foreignKey: 'completadoPor', as: 'completedBy' })
  declare completedBy: User;

  @Column({ type: DataType.DATE, field: 'fecha_completado', allowNull: true })
  declare fechaCompletado: Date | null;

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
