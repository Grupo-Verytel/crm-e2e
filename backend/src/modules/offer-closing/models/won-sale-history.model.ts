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

/**
 * Bitácora de la venta ganada. A diferencia del resto de hijos, estas filas son
 * historia: el `PUT` las conserva y solo añade las nuevas.
 */
@Table({
  tableName: 'won_sale_history',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class WonSaleHistoryEntry extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'won_sale_history_entry_id' })
  declare wonSaleHistoryEntryId: string;

  @ForeignKey(() => WonSale)
  @Column({ type: DataType.CHAR(36), field: 'won_sale_id', allowNull: false })
  declare wonSaleId: string;

  @BelongsTo(() => WonSale)
  declare wonSale: WonSale;

  @Column({ type: DataType.STRING(160), allowNull: false })
  declare estado: string;

  @Column({ type: DataType.DATE(3), allowNull: false })
  declare fecha: Date;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare origen: string;

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
