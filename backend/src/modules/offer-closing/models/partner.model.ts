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
 * Aliado que puede ejecutar un proyecto ganado junto a Frisson/Verytel.
 * Catálogo propio de Cierre de Oferta, misma forma que `JointVenture`
 * (DR 2026-10 UT y aliados).
 */
@Table({
  tableName: 'partners',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class Partner extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'partner_id' })
  declare partnerId: string;

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
