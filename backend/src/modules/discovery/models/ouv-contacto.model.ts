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
import { OuvInfluencia } from './ouv-influencia.model';
import { Ouv } from './ouv.model';

/**
 * Contactos owned by an OUV (discovery module).
 * Autocontained — no FK to lead_contacts / demand-generation.
 */
@Table({
  tableName: 'ouv_contactos',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class OuvContacto extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'contacto_ouv_id' })
  declare contactoOuvId: string;

  @ForeignKey(() => Ouv)
  @Column({ type: DataType.CHAR(36), field: 'ouv_id', allowNull: false })
  declare ouvId: string;

  @BelongsTo(() => Ouv, { foreignKey: 'ouvId', as: 'ouv' })
  declare ouv: Ouv;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare nombre: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare cargo: string | null;

  @Column({ type: DataType.STRING(180), allowNull: true })
  declare email: string | null;

  @Column({ type: DataType.STRING(20), allowNull: true })
  declare telefono: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notas: string | null;

  @HasMany(() => OuvInfluencia, {
    foreignKey: 'contactoOuvId',
    as: 'influencias',
  })
  declare influencias: OuvInfluencia[];

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
