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
import { JointVenture } from './joint-venture.model';
import { Partner } from './partner.model';
import { WonSale } from './won-sale.model';

export type EmpresaEjecutora = 'Frisson' | 'Verytel' | 'UT' | 'Aliado';

/**
 * Empresa que ejecuta el proyecto y su % de ingresos. La suma de
 * `participacion_pct` de todas las filas de una venta debe dar 100.0 para
 * enviar el proyecto al PMO; mientras se diligencia puede no cuadrar.
 *
 * Las filas UT y Aliado apuntan a su catálogo; `nombre` es la foto del nombre
 * al momento de asignarla.
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

  /** Un decimal (33.3). MySQL devuelve DECIMAL como cadena. */
  @Default(0)
  @Column({
    type: DataType.DECIMAL(4, 1),
    field: 'participacion_pct',
    allowNull: false,
  })
  declare participacionPct: string;

  /** Botón que creó la fila; `null` si es un socio externo escrito a mano. */
  @Column({
    type: DataType.ENUM('Frisson', 'Verytel', 'UT', 'Aliado'),
    allowNull: true,
  })
  declare empresa: EmpresaEjecutora | null;

  /** Solo en filas `UT`. */
  @ForeignKey(() => JointVenture)
  @Column({
    type: DataType.CHAR(36),
    field: 'joint_venture_id',
    allowNull: true,
  })
  declare jointVentureId: string | null;

  @BelongsTo(() => JointVenture)
  declare jointVenture: JointVenture | null;

  /** Solo en filas `Aliado`. */
  @ForeignKey(() => Partner)
  @Column({ type: DataType.CHAR(36), field: 'partner_id', allowNull: true })
  declare partnerId: string | null;

  @BelongsTo(() => Partner)
  declare partner: Partner | null;

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
