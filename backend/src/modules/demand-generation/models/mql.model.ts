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
import { MqlEstado } from './enums/mql.enums';
import { LeadChecklist } from './lead-checklist.model';
import { Lead } from './lead.model';

@Table({
  tableName: 'mqls',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class Mql extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'mql_id' })
  declare mqlId: string;

  @ForeignKey(() => Lead)
  @Column({
    type: DataType.CHAR(36),
    field: 'lead_id',
    allowNull: false,
    unique: true,
  })
  declare leadId: string;

  @BelongsTo(() => Lead)
  declare lead: Lead;

  @ForeignKey(() => LeadChecklist)
  @Column({ type: DataType.CHAR(36), field: 'checklist_id', allowNull: false })
  declare checklistId: string;

  @BelongsTo(() => LeadChecklist)
  declare checklist: LeadChecklist;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'calificado_por',
    allowNull: false,
  })
  declare calificadoPor: string;

  @BelongsTo(() => User, { foreignKey: 'calificadoPor', as: 'qualifiedBy' })
  declare qualifiedBy: User;

  @Default(DataType.NOW)
  @Column({
    type: DataType.DATE,
    field: 'fecha_calificacion',
    allowNull: false,
  })
  declare fechaCalificacion: Date;

  @Column({
    type: DataType.TEXT,
    field: 'motivo_calificacion',
    allowNull: true,
  })
  declare motivoCalificacion: string | null;

  @Default(MqlEstado.Activo)
  @Column({
    type: DataType.ENUM(...Object.values(MqlEstado)),
    allowNull: false,
  })
  declare estado: MqlEstado;

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
