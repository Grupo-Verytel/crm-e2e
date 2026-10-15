import {
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

/**
 * Unión temporal que puede ejecutar un proyecto ganado. Catálogo propio de
 * Cierre de Oferta: solo NIT y nombre, sin integrantes (DR 2026-10 UT y
 * aliados). El % de cada UT se fija por proyecto en `won_sale_members`.
 */
@Table({
  tableName: 'joint_ventures',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class JointVenture extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'joint_venture_id' })
  declare jointVentureId: string;

  /** Base del NIT, solo dígitos; el DV va aparte. */
  @Column({ type: DataType.STRING(15), field: 'tax_id', allowNull: false })
  declare taxId: string;

  @Column({
    type: DataType.CHAR(1),
    field: 'verification_digit',
    allowNull: false,
  })
  declare verificationDigit: string;

  @Column({ type: DataType.STRING(160), allowNull: false })
  declare name: string;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare active: boolean;

  @Column({ type: DataType.CHAR(36), field: 'created_by', allowNull: true })
  declare createdBy: string | null;

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
