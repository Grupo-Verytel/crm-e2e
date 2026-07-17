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
import { Lead } from './lead.model';

@Table({
  tableName: 'lead_contacts',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class LeadContact extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'contact_id' })
  declare contactId: string;

  @ForeignKey(() => Lead)
  @Column({ type: DataType.CHAR(36), field: 'lead_id', allowNull: false })
  declare leadId: string;

  @BelongsTo(() => Lead)
  declare lead: Lead;

  @Column({ type: DataType.TINYINT.UNSIGNED, allowNull: false })
  declare position: number;

  @Column({
    type: DataType.STRING(120),
    field: 'empresa_nombre',
    allowNull: false,
  })
  declare empresaNombre: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare nombre: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare cargo: string | null;

  @Column({ type: DataType.STRING(180), allowNull: false })
  declare email: string;

  @Column({ type: DataType.STRING(20), allowNull: true })
  declare telefono: string | null;

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
