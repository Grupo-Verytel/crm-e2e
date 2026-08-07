import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../auth/models/user.model';
import { Sql } from '../../demand-generation/models/sql.model';
import {
  OuvOrigenVia,
  OuvResultado,
  OuvSegmento,
  OuvZona,
  PresupuestoFuente,
  PresupuestoMoneda,
} from './enums/ouv.enums';
import { OuvChecklistItem } from './ouv-checklist-item.model';
import { OuvContacto } from './ouv-contacto.model';
import { OuvInfluencia } from './ouv-influencia.model';

@Table({
  tableName: 'ouvs',
  timestamps: true,
  underscored: true,
})
export class Ouv extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'ouv_id' })
  declare ouvId: string;

  @Column({ type: DataType.STRING(20), allowNull: false, unique: true })
  declare consecutivo: string;

  /** NULL for OUVs creadas directamente (Vías 2/3/4). */
  @ForeignKey(() => Sql)
  @Column({
    type: DataType.CHAR(36),
    field: 'sql_id_origen',
    allowNull: true,
    unique: true,
  })
  declare sqlIdOrigen: string | null;

  @BelongsTo(() => Sql, { foreignKey: 'sqlIdOrigen', as: 'sqlOrigen' })
  declare sqlOrigen: Sql | null;

  @Column({
    type: DataType.ENUM(...Object.values(OuvOrigenVia)),
    field: 'origen_via',
    allowNull: false,
  })
  declare origenVia: OuvOrigenVia;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'comercial_id',
    allowNull: false,
  })
  declare comercialId: string;

  @BelongsTo(() => User, { foreignKey: 'comercialId', as: 'comercial' })
  declare comercial: User;

  @Column({ type: DataType.STRING(200), allowNull: false })
  declare titulo: string;

  /** Snapshot of client name (from lead in Vía 1, or captured by comercial). */
  @Column({
    type: DataType.STRING(200),
    field: 'empresa_nombre',
    allowNull: false,
  })
  declare empresaNombre: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare descripcion: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(OuvSegmento)),
    allowNull: false,
  })
  declare segmento: OuvSegmento;

  /** VARCHAR in DB; validated against OuvVertical in DTOs. */
  @Column({ type: DataType.STRING(80), allowNull: false })
  declare vertical: string;

  @Default(OuvZona.Universo)
  @Column({
    type: DataType.ENUM(...Object.values(OuvZona)),
    field: 'zona_actual',
    allowNull: false,
  })
  declare zonaActual: OuvZona;

  @Default(OuvResultado.EnCurso)
  @Column({
    type: DataType.ENUM(...Object.values(OuvResultado)),
    allowNull: false,
  })
  declare resultado: OuvResultado;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    field: 'tiene_gap',
    allowNull: false,
  })
  declare tieneGap: boolean;

  @Column({
    type: DataType.JSON,
    field: 'criterios_faltantes',
    allowNull: true,
  })
  declare criteriosFaltantes: string[] | null;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    field: 'presupuesto_confirmado',
    allowNull: false,
  })
  declare presupuestoConfirmado: boolean;

  @Column({
    type: DataType.DECIMAL(18, 2),
    field: 'presupuesto_monto',
    allowNull: true,
  })
  declare presupuestoMonto: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(PresupuestoMoneda)),
    field: 'presupuesto_moneda',
    allowNull: true,
  })
  declare presupuestoMoneda: PresupuestoMoneda | null;

  @Column({
    type: DataType.DATE,
    field: 'presupuesto_fecha_captura',
    allowNull: true,
  })
  declare presupuestoFechaCaptura: Date | null;

  @Column({
    type: DataType.ENUM(...Object.values(PresupuestoFuente)),
    field: 'presupuesto_fuente',
    allowNull: true,
  })
  declare presupuestoFuente: PresupuestoFuente | null;

  /** Polymorphic ref to motivos_perdida | motivos_descarte — no FK. */
  @Column({
    type: DataType.CHAR(36),
    field: 'motivo_id',
    allowNull: true,
  })
  declare motivoId: string | null;

  @Column({
    type: DataType.STRING(200),
    field: 'motivo_snapshot',
    allowNull: true,
  })
  declare motivoSnapshot: string | null;

  @Column({ type: DataType.TEXT, field: 'motivo_detalle', allowNull: true })
  declare motivoDetalle: string | null;

  @Column({
    type: DataType.STRING(200),
    field: 'competidor_ganador',
    allowNull: true,
  })
  declare competidorGanador: string | null;

  @Column({
    type: DataType.DECIMAL(18, 2),
    field: 'monto_final',
    allowNull: true,
  })
  declare montoFinal: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(PresupuestoMoneda)),
    field: 'moneda_final',
    allowNull: true,
  })
  declare monedaFinal: PresupuestoMoneda | null;

  @Column({
    type: DataType.DECIMAL(18, 2),
    field: 'monto_estimado_perdido',
    allowNull: true,
  })
  declare montoEstimadoPerdido: string | null;

  @Column({ type: DataType.DATE, field: 'fecha_cierre', allowNull: true })
  declare fechaCierre: Date | null;

  @HasMany(() => OuvContacto, { foreignKey: 'ouvId', as: 'contactos' })
  declare contactos: OuvContacto[];

  @HasMany(() => OuvInfluencia, { foreignKey: 'ouvId', as: 'influencias' })
  declare influencias: OuvInfluencia[];

  @HasMany(() => OuvChecklistItem, {
    foreignKey: 'ouvId',
    as: 'checklistItems',
  })
  declare checklistItems: OuvChecklistItem[];

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;
}
