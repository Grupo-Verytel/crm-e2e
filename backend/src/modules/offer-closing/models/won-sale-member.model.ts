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
import { WonSale } from './won-sale.model';

export type EmpresaEjecutora = 'Frisson' | 'Verytel' | 'UT';

/**
 * Miembro de la unión temporal que ejecuta el proyecto. La suma de
 * `participacion_pct` de todas las filas de una venta debe dar 100.
 */
@Table({
  tableName: 'won_sale_members',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class WonSaleMember extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'won_sale_member_id' })
  declare wonSaleMemberId: string;

  @ForeignKey(() => WonSale)
  @Column({ type: DataType.CHAR(36), field: 'won_sale_id', allowNull: false })
  declare wonSaleId: string;

  @BelongsTo(() => WonSale)
  declare wonSale: WonSale;

  /** Identidad que usa el frontend; el nombre es editable y no sirve de llave. */
  @Column({ type: DataType.STRING(64), field: 'ref_id', allowNull: false })
  declare refId: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare nombre: string;

  @Default(0)
  @Column({
    type: DataType.SMALLINT,
    field: 'participacion_pct',
    allowNull: false,
  })
  declare participacionPct: number;

  /** Botón que creó la fila; `null` si es un socio externo escrito a mano. */
  @Column({
    type: DataType.ENUM('Frisson', 'Verytel', 'UT'),
    allowNull: true,
  })
  declare empresa: EmpresaEjecutora | null;

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
