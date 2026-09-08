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

export type ValidacionTipo = 'Tecnica' | 'Financiera';

export type ValidacionEstado = 'Pendiente' | 'Aprobado' | 'Rechazado';

/** Viabilidad técnica y financiera: la compuerta que habilita el Kickoff. */
@Table({
  tableName: 'won_sale_validations',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class WonSaleValidation extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'won_sale_validation_id' })
  declare wonSaleValidationId: string;

  @ForeignKey(() => WonSale)
  @Column({ type: DataType.CHAR(36), field: 'won_sale_id', allowNull: false })
  declare wonSaleId: string;

  @BelongsTo(() => WonSale)
  declare wonSale: WonSale;

  @Column({
    type: DataType.ENUM('Tecnica', 'Financiera'),
    allowNull: false,
  })
  declare tipo: ValidacionTipo;

  @Default('Pendiente')
  @Column({
    type: DataType.ENUM('Pendiente', 'Aprobado', 'Rechazado'),
    allowNull: false,
  })
  declare estado: ValidacionEstado;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare observacion: string | null;

  /** Nombre de quien dejó el dictamen, tal como se muestra en pantalla. */
  @Column({ type: DataType.STRING(160), allowNull: true })
  declare usuario: string | null;

  @Column({ type: DataType.DATE(3), allowNull: true })
  declare fecha: Date | null;

  @Column({ type: DataType.TEXT, field: 'sharepoint_url', allowNull: true })
  declare sharepointUrl: string | null;

  @Column({
    type: DataType.STRING(255),
    field: 'sharepoint_nombre',
    allowNull: true,
  })
  declare sharepointNombre: string | null;

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
