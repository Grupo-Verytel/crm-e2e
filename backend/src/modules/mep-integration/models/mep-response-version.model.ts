import {
  BeforeDestroy,
  BeforeUpdate,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import {
  BusinessMilestone,
  CapacityStatus,
  ResponseStatus,
  RouteStatus,
} from '../domain/enums';
import { MepResponse } from './mep-response.model';
import { MepServiceResult } from './mep-service-result.model';

/**
 * §8 `mep_response_version` — cada versión es inmutable (append-only).
 *
 * P-08: `narrative_note` contiene SOLO el texto de esta `response_version`,
 * nunca la historia acumulada.
 * INV-17: `rc_version` (V1/Vx) es un reloj independiente de `response_version`;
 * puede quedarse en V2 mientras la versión 5 informa el cierre.
 * `delivered_interaction_type` es NULL en todo hito anterior al cierre (INV-20).
 */
@Table({
  tableName: 'mep_response_version',
  timestamps: true,
  updatedAt: false,
  underscored: true,
})
export class MepResponseVersion extends Model {
  @PrimaryKey
  @Column({ type: DataType.BIGINT, autoIncrement: true })
  declare id: string;

  @ForeignKey(() => MepResponse)
  @Column({ type: DataType.BIGINT, field: 'mep_response_id', allowNull: false })
  declare mepResponseId: string;

  @Column({
    type: DataType.INTEGER,
    field: 'response_version',
    allowNull: false,
  })
  declare responseVersion: number;

  @Column({
    type: DataType.ENUM(...Object.values(BusinessMilestone)),
    field: 'business_milestone',
    allowNull: false,
  })
  declare businessMilestone: BusinessMilestone;

  @Column({
    type: DataType.ENUM(...Object.values(ResponseStatus)),
    field: 'response_status',
    allowNull: false,
  })
  declare responseStatus: ResponseStatus;

  @Column({ type: DataType.DATEONLY, field: 'eta_date', allowNull: true })
  declare etaDate: string | null;

  @Column({
    type: DataType.STRING(512),
    field: 'next_milestone',
    allowNull: true,
  })
  declare nextMilestone: string | null;

  @Column({ type: DataType.DATE(3), field: 'responded_at', allowNull: false })
  declare respondedAt: Date;

  @Column({
    type: DataType.STRING(64),
    field: 'responded_by_ref',
    allowNull: false,
  })
  declare respondedByRef: string;

  @Column({
    type: DataType.STRING(256),
    field: 'responded_by_name',
    allowNull: false,
  })
  declare respondedByName: string;

  @Column({
    type: DataType.STRING(64),
    field: 'assignment_engineer_ref',
    allowNull: true,
  })
  declare assignmentEngineerRef: string | null;

  @Column({
    type: DataType.STRING(256),
    field: 'assignment_engineer_name',
    allowNull: true,
  })
  declare assignmentEngineerName: string | null;

  @Column({
    type: DataType.DATE(3),
    field: 'assignment_assigned_at',
    allowNull: true,
  })
  declare assignmentAssignedAt: Date | null;

  @Column({ type: DataType.STRING(8), field: 'rc_version', allowNull: true })
  declare rcVersion: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(RouteStatus)),
    field: 'rc_route_status',
    allowNull: true,
  })
  declare rcRouteStatus: RouteStatus | null;

  @Column({
    type: DataType.ENUM(...Object.values(CapacityStatus)),
    field: 'rc_capacity_status',
    allowNull: true,
  })
  declare rcCapacityStatus: CapacityStatus | null;

  @Column({ type: DataType.TEXT, field: 'rc_summary', allowNull: true })
  declare rcSummary: string | null;

  @Column({
    type: DataType.DATE(3),
    field: 'rc_registered_at',
    allowNull: true,
  })
  declare rcRegisteredAt: Date | null;

  @Column({
    type: DataType.STRING(64),
    field: 'rc_registered_by_ref',
    allowNull: true,
  })
  declare rcRegisteredByRef: string | null;

  @Column({
    type: DataType.STRING(256),
    field: 'rc_registered_by_name',
    allowNull: true,
  })
  declare rcRegisteredByName: string | null;

  @Column({
    type: DataType.STRING(1024),
    field: 'planner_interaction_url',
    allowNull: true,
  })
  declare plannerInteractionUrl: string | null;

  @Column({
    type: DataType.STRING(1024),
    field: 'route_capacity_register_url',
    allowNull: true,
  })
  declare routeCapacityRegisterUrl: string | null;

  @Column({ type: DataType.TEXT, field: 'narrative_note', allowNull: true })
  declare narrativeNote: string | null;

  @Column({
    type: DataType.STRING(128),
    field: 'delivered_interaction_type',
    allowNull: true,
  })
  declare deliveredInteractionType: string | null;

  @Column({
    type: DataType.CHAR(64),
    field: 'semantic_fingerprint',
    allowNull: false,
  })
  declare semanticFingerprint: string;

  @Column({ type: DataType.CHAR(64), field: 'payload_hash', allowNull: false })
  declare payloadHash: string;

  @Column({ type: DataType.STRING(96), allowNull: false })
  declare etag: string;

  @BelongsTo(() => MepResponse)
  declare response: MepResponse;

  @HasMany(() => MepServiceResult)
  declare serviceResults: MepServiceResult[];

  @BeforeUpdate
  @BeforeDestroy
  static preventMutation(): never {
    throw new Error('mep_response_version is append-only');
  }
}
