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
import { User } from '../../auth/models/user.model';
import { Campaign } from './campaign.model';
import {
  CanalOrigen,
  LeadEstado,
  OrigenLead,
  TipoInfluencia,
  TipoLead,
} from './enums/lead.enums';
import { Segmento } from './enums/segment.enum';

@Table({
  tableName: 'leads',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class Lead extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'lead_id' })
  declare leadId: string;

  @Column({
    type: DataType.ENUM(...Object.values(TipoLead)),
    field: 'tipo_lead',
    allowNull: false,
  })
  declare tipoLead: TipoLead;

  @Column({
    type: DataType.ENUM(...Object.values(OrigenLead)),
    allowNull: false,
  })
  declare origen: OrigenLead;

  @Column({
    type: DataType.ENUM(...Object.values(CanalOrigen)),
    field: 'canal_origen',
    allowNull: false,
  })
  declare canalOrigen: CanalOrigen;

  @Column({ type: DataType.STRING(80), field: 'sub_origen', allowNull: true })
  declare subOrigen: string | null;

  @ForeignKey(() => Campaign)
  @Column({ type: DataType.CHAR(36), field: 'campana_id', allowNull: true })
  declare campanaId: string | null;

  @BelongsTo(() => Campaign)
  declare campana: Campaign;

  @Column({
    type: DataType.ENUM(...Object.values(Segmento)),
    allowNull: false,
  })
  declare segmento: Segmento;

  /** Required when segmento = B2B (enforced in DTO/service). */
  @Column({ type: DataType.STRING(80), allowNull: true })
  declare industria: string | null;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare region: string;

  @Column({ type: DataType.CHAR(2), allowNull: false })
  declare pais: string;

  @Column({
    type: DataType.STRING(120),
    field: 'empresa_nombre',
    allowNull: false,
  })
  declare empresaNombre: string;

  /** Unique when present (enforced via partial unique index in migration). */
  @Column({ type: DataType.STRING(20), allowNull: true })
  declare nit: string | null;

  @Column({
    type: DataType.STRING(120),
    field: 'contacto_nombre',
    allowNull: false,
  })
  declare contactoNombre: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare cargo: string | null;

  @Column({ type: DataType.STRING(180), allowNull: false })
  declare email: string;

  /** E.164 format when present (normalized in service). */
  @Column({ type: DataType.STRING(20), allowNull: true })
  declare telefono: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(TipoInfluencia)),
    field: 'tipo_influencia',
    allowNull: true,
  })
  declare tipoInfluencia: TipoInfluencia | null;

  @Default(LeadEstado.Nuevo)
  @Column({
    type: DataType.ENUM(...Object.values(LeadEstado)),
    allowNull: false,
  })
  declare estado: LeadEstado;

  /** Persisted from qualification module — never calculated here. */
  @Column({
    type: DataType.SMALLINT,
    field: 'icp_score',
    allowNull: true,
    validate: { min: 0, max: 100 },
  })
  declare icpScore: number | null;

  /** Wave 2 scoring — modeled but inactive (no calculation engine in v1). */
  @Column({ type: DataType.SMALLINT, field: 'lead_score', allowNull: true })
  declare leadScore: number | null;

  @Column({ type: DataType.SMALLINT, field: 'mql_score', allowNull: true })
  declare mqlScore: number | null;

  @Column({ type: DataType.SMALLINT, field: 'sql_score', allowNull: true })
  declare sqlScore: number | null;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'responsable_id',
    allowNull: false,
  })
  declare responsableId: string;

  @BelongsTo(() => User, { foreignKey: 'responsableId', as: 'responsable' })
  declare responsable: User;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, field: 'cita_agendada', allowNull: false })
  declare citaAgendada: boolean;

  @Column({ type: DataType.DATE, field: 'fecha_cita', allowNull: true })
  declare fechaCita: Date | null;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'comercial_asignado_id',
    allowNull: true,
  })
  declare comercialAsignadoId: string | null;

  @BelongsTo(() => User, {
    foreignKey: 'comercialAsignadoId',
    as: 'comercialAsignado',
  })
  declare comercialAsignado: User | null;

  /** Required when estado = Descartado (enforced in DTO/service). */
  @Column({ type: DataType.TEXT, field: 'motivo_descarte', allowNull: true })
  declare motivoDescarte: string | null;

  @Column({ type: DataType.STRING(120), field: 'utm_source', allowNull: true })
  declare utmSource: string | null;

  @Column({ type: DataType.STRING(120), field: 'utm_medium', allowNull: true })
  declare utmMedium: string | null;

  @Column({
    type: DataType.STRING(120),
    field: 'utm_campaign',
    allowNull: true,
  })
  declare utmCampaign: string | null;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, field: 'fecha_captura', allowNull: false })
  declare fechaCaptura: Date;

  /** Updated whenever an interaction is registered (DG-04). */
  @Column({
    type: DataType.DATE,
    field: 'fecha_ultima_interaccion',
    allowNull: true,
  })
  declare fechaUltimaInteraccion: Date | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.CHAR(36), field: 'created_by', allowNull: false })
  declare createdBy: string;

  @BelongsTo(() => User, { foreignKey: 'createdBy', as: 'creator' })
  declare creator: User;

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
