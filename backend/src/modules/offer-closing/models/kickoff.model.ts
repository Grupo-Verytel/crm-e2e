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
import { KickoffApproval } from './kickoff-approval.model';
import { KickoffInvitee } from './kickoff-invitee.model';

export type KickoffStatus = 'Programado' | 'Realizado' | 'Cancelado';

export type KickoffLocationType = 'Teams' | 'Presencial';

/**
 * Kickoff de una venta ganada: un registro por OUV.
 *
 * Guarda el vínculo con el evento real de Microsoft 365 (`graph_event_id`,
 * `join_url`) para que cualquier usuario pueda ver, reagendar o cancelar la
 * reunión — antes ese dato vivía solo en el `localStorage` del navegador que
 * la había creado.
 */
@Table({
  tableName: 'kickoffs',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class Kickoff extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'kickoff_id' })
  declare kickoffId: string;

  @Column({ type: DataType.CHAR(36), field: 'ouv_id', allowNull: false })
  declare ouvId: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  @Column({ type: DataType.DATE(3), field: 'starts_at', allowNull: true })
  declare startsAt: Date | null;

  @Column({ type: DataType.DATE(3), field: 'ends_at', allowNull: true })
  declare endsAt: Date | null;

  @Default('America/Bogota')
  @Column({ type: DataType.STRING(64), field: 'time_zone', allowNull: false })
  declare timeZone: string;

  /** `['Teams']`, `['Presencial']` o ambas. */
  @Default([])
  @Column({ type: DataType.JSON, field: 'location_types', allowNull: false })
  declare locationTypes: KickoffLocationType[];

  @Column({ type: DataType.STRING(255), field: 'room_email', allowNull: true })
  declare roomEmail: string | null;

  /** Etiqueta de la sala tal como la muestra el CRM (ej. `Sala Marte`). */
  @Column({ type: DataType.STRING(120), field: 'room_label', allowNull: true })
  declare roomLabel: string | null;

  @Column({
    type: DataType.STRING(255),
    field: 'location_detail',
    allowNull: true,
  })
  declare locationDetail: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string | null;

  @Default('Programado')
  @Column({
    type: DataType.ENUM('Programado', 'Realizado', 'Cancelado'),
    allowNull: false,
  })
  declare status: KickoffStatus;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    field: 'scheduling_confirmed',
    allowNull: false,
  })
  declare schedulingConfirmed: boolean;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    field: 'teams_validated',
    allowNull: false,
  })
  declare teamsValidated: boolean;

  @Column({ type: DataType.DATE(3), field: 'held_at', allowNull: true })
  declare heldAt: Date | null;

  /** Identificador del evento en Graph — largo y opaco, no se indexa. */
  @Column({
    type: DataType.STRING(512),
    field: 'graph_event_id',
    allowNull: true,
  })
  declare graphEventId: string | null;

  @Column({
    type: DataType.STRING(255),
    field: 'graph_organizer_upn',
    allowNull: true,
  })
  declare graphOrganizerUpn: string | null;

  @Column({ type: DataType.TEXT, field: 'join_url', allowNull: true })
  declare joinUrl: string | null;

  @Column({ type: DataType.TEXT, field: 'web_link', allowNull: true })
  declare webLink: string | null;

  @Column({ type: DataType.DATE(3), field: 'confirmed_at', allowNull: true })
  declare confirmedAt: Date | null;

  @Column({ type: DataType.CHAR(36), field: 'created_by', allowNull: true })
  declare createdBy: string | null;

  @Column({ type: DataType.CHAR(36), field: 'updated_by', allowNull: true })
  declare updatedBy: string | null;

  @HasMany(() => KickoffInvitee)
  declare invitees: KickoffInvitee[];

  @HasMany(() => KickoffApproval)
  declare approvals: KickoffApproval[];

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
