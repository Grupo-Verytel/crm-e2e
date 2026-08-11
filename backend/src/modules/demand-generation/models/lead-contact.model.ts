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

  /** FK to people.person_id — enriched via AccountsService (no cross-module BelongsTo). */
  @Column({ type: DataType.CHAR(36), field: 'person_id', allowNull: false })
  declare personId: string;

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
