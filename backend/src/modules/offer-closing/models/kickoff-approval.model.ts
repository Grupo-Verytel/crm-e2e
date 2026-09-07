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
import { Kickoff } from './kickoff.model';

/** Aprobaciones de la etapa 4: aval comercial, transferencia técnica y PMO. */
@Table({
  tableName: 'kickoff_approvals',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class KickoffApproval extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'kickoff_approval_id' })
  declare kickoffApprovalId: string;

  @ForeignKey(() => Kickoff)
  @Column({ type: DataType.CHAR(36), field: 'kickoff_id', allowNull: false })
  declare kickoffId: string;

  @BelongsTo(() => Kickoff)
  declare kickoff: Kickoff;

  /** `comercial` | `tecnico` | `pmo`. */
  @Column({ type: DataType.STRING(32), allowNull: false })
  declare code: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare label: string;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare completed: boolean;

  @Column({ type: DataType.DATE(3), field: 'completed_at', allowNull: true })
  declare completedAt: Date | null;

  @Column({ type: DataType.CHAR(36), field: 'completed_by', allowNull: true })
  declare completedBy: string | null;

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
