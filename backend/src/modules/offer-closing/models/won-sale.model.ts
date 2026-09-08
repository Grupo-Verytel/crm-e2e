import {
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { WonSaleAlert } from './won-sale-alert.model';
import { WonSaleHistoryEntry } from './won-sale-history.model';
import { WonSaleMember } from './won-sale-member.model';
import { WonSaleValidation } from './won-sale-validation.model';

export type EstadoRevision = 'Pendiente' | 'EnRevision' | 'Aprobada';

export type EnvioPmoEstado =
  | 'NoEnviado'
  | 'Pendiente'
  | 'Enviado'
  | 'Rechazado'
  | 'Error';

export type TipoVenta = 'Licitacion' | 'VentaDirecta';

/**
 * Expediente de cierre de una venta ganada: un registro por OUV.
 *
 * Antes vivía entero en el `localStorage` del navegador que lo diligenciaba,
 * así que dos usuarios sobre la misma OUV veían formularios distintos. Aquí se
 * guarda todo lo que la pantalla `/offers/:ouvId` edita o decide.
 *
 * Los indicadores y el CSAT se conservan como JSON: hoy provienen de datos
 * simulados y su forma todavía no está cerrada, así que no merecen columnas
 * propias hasta que exista la fuente real.
 */
@Table({
  tableName: 'won_sales',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class WonSale extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'won_sale_id' })
  declare wonSaleId: string;

  @Column({ type: DataType.CHAR(36), field: 'ouv_id', allowNull: false })
  declare ouvId: string;

  @Default('Pendiente')
  @Column({
    type: DataType.ENUM('Pendiente', 'EnRevision', 'Aprobada'),
    field: 'estado_revision',
    allowNull: false,
  })
  declare estadoRevision: EstadoRevision;

  // --- Datos base del proyecto (el formulario) ---

  @Column({
    type: DataType.STRING(255),
    field: 'nombre_proyecto',
    allowNull: false,
    defaultValue: '',
  })
  declare nombreProyecto: string;

  @Column({ type: DataType.DATEONLY, field: 'fecha_inicio', allowNull: true })
  declare fechaInicio: string | null;

  @Column({ type: DataType.DATEONLY, field: 'fecha_fin', allowNull: true })
  declare fechaFin: string | null;

  /** COP sin decimales; DECIMAL evita el redondeo binario de FLOAT. */
  @Default(0)
  @Column({
    type: DataType.DECIMAL(18, 2),
    field: 'valor_facturar',
    allowNull: false,
  })
  declare valorFacturar: string;

  @Default(0)
  @Column({
    type: DataType.DECIMAL(18, 2),
    field: 'costo_estimado',
    allowNull: false,
  })
  declare costoEstimado: string;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare recurrente: boolean;

  @Default('VentaDirecta')
  @Column({
    type: DataType.ENUM('Licitacion', 'VentaDirecta'),
    field: 'tipo_venta',
    allowNull: false,
  })
  declare tipoVenta: TipoVenta;

  @Column({
    type: DataType.CHAR(36),
    field: 'director_proyecto_id',
    allowNull: true,
  })
  declare directorProyectoId: string | null;

  @Column({
    type: DataType.STRING(160),
    field: 'director_proyecto_nombre',
    allowNull: true,
  })
  declare directorProyectoNombre: string | null;

  @Column({
    type: DataType.STRING(120),
    field: 'centro_costos',
    allowNull: true,
  })
  declare centroCostos: string | null;

  @Column({ type: DataType.STRING(120), allowNull: true })
  declare ubv: string | null;

  @Column({ type: DataType.STRING(120), allowNull: true })
  declare participacion: string | null;

  @Default(0)
  @Column({
    type: DataType.SMALLINT,
    field: 'participacion_pct',
    allowNull: false,
  })
  declare participacionPct: number;

  // --- Envío a Control de Proyectos ---

  @Default('NoEnviado')
  @Column({
    type: DataType.ENUM(
      'NoEnviado',
      'Pendiente',
      'Enviado',
      'Rechazado',
      'Error',
    ),
    field: 'envio_pmo_estado',
    allowNull: false,
  })
  declare envioPmoEstado: EnvioPmoEstado;

  @Column({
    type: DataType.STRING(60),
    field: 'envio_pmo_consecutivo',
    allowNull: true,
  })
  declare envioPmoConsecutivo: string | null;

  @Column({
    type: DataType.STRING(60),
    field: 'envio_pmo_ser',
    allowNull: true,
  })
  declare envioPmoSer: string | null;

  @Column({ type: DataType.TEXT, field: 'envio_pmo_motivo', allowNull: true })
  declare envioPmoMotivo: string | null;

  @Column({
    type: DataType.DATE(3),
    field: 'envio_pmo_enviado_en',
    allowNull: true,
  })
  declare envioPmoEnviadoEn: Date | null;

  // --- Bloques todavía sin fuente real ---

  @Column({ type: DataType.JSON, allowNull: true })
  declare indicadores: unknown;

  @Column({ type: DataType.JSON, allowNull: true })
  declare csat: unknown;

  @Column({ type: DataType.CHAR(36), field: 'created_by', allowNull: true })
  declare createdBy: string | null;

  @Column({ type: DataType.CHAR(36), field: 'updated_by', allowNull: true })
  declare updatedBy: string | null;

  @HasMany(() => WonSaleValidation)
  declare validaciones: WonSaleValidation[];

  @HasMany(() => WonSaleMember)
  declare miembros: WonSaleMember[];

  @HasMany(() => WonSaleAlert)
  declare alertas: WonSaleAlert[];

  @HasMany(() => WonSaleHistoryEntry)
  declare historial: WonSaleHistoryEntry[];

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
