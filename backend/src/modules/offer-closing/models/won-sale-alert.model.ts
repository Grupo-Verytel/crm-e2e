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

export type AlertaEstado = 'Pendiente' | 'Activa' | 'Resuelta';

/** Aviso vigente sobre la venta (validación pendiente, envío bloqueado…). */
@Table({
  tableName: 'won_sale_alerts',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class WonSaleAlert extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'won_sale_alert_id' })
  declare wonSaleAlertId: string;

  @ForeignKey(() => WonSale)
  @Column({ type: DataType.CHAR(36), field: 'won_sale_id', allowNull: false })
  declare wonSaleId: string;

  @BelongsTo(() => WonSale)
  declare wonSale: WonSale;

  /** Identificador estable que asigna el frontend (ej. `val-block`). */
  @Column({ type: DataType.STRING(64), field: 'ref_id', allowNull: false })
  declare refId: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare tipo: string;

  @Default('Activa')
  @Column({
    type: DataType.ENUM('Pendiente', 'Activa', 'Resuelta'),
    allowNull: false,
  })
  declare estado: AlertaEstado;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare descripcion: string;

  @Column({ type: DataType.DATE(3), allowNull: true })
  declare fecha: Date | null;

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
