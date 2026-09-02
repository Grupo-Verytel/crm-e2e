import {
  BeforeDestroy,
  BeforeUpdate,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export enum AuditActorType {
  SERVICE = 'SERVICE',
  USER = 'USER',
  SYSTEM = 'SYSTEM',
}

export enum AuditOutcome {
  SUCCESS = 'SUCCESS',
  REJECTED = 'REJECTED',
  ERROR = 'ERROR',
}

/**
 * §12.1 — bitácora append-only, inmutable y encadenada de la integración.
 *
 * Desviación de nombre respecto del spec: el spec la llama `audit_log`, pero
 * ese nombre ya está tomado en el CRM por la auditoría de entidades comerciales
 * (columnas `tabla`/`registro_id`/`accion`, incompatibles con este esquema).
 * Por Artículo II de CONSTITUTION.md — la realidad del repo manda — esta tabla
 * se llama `mep_audit_log` y conserva íntegras todas las columnas del §12.1.
 *
 * INV-31: nunca almacena el valor de `X-API-Key` ni `source_content` completo;
 *         `before_state`/`after_state` van redactados.
 * INV-32: se escribe en la misma transacción que la mutación.
 * INV-33: append-only — sin UPDATE ni DELETE.
 * INV-34: `entry_hash` encadena con `prev_hash`.
 */
@Table({
  tableName: 'mep_audit_log',
  timestamps: false,
  underscored: true,
})
export class MepAuditLog extends Model {
  @PrimaryKey
  @Column({ type: DataType.BIGINT, autoIncrement: true })
  declare id: string;

  @Column({ type: DataType.DATE(3), field: 'occurred_at', allowNull: false })
  declare occurredAt: Date;

  @Column({
    type: DataType.STRING(128),
    field: 'correlation_id',
    allowNull: false,
  })
  declare correlationId: string;

  @Column({ type: DataType.STRING(64), field: 'request_id', allowNull: false })
  declare requestId: string;

  @Column({
    type: DataType.ENUM(...Object.values(AuditActorType)),
    field: 'actor_type',
    allowNull: false,
  })
  declare actorType: AuditActorType;

  @Column({
    type: DataType.STRING(64),
    field: 'actor_identity',
    allowNull: false,
  })
  declare actorIdentity: string;

  @Column({ type: DataType.CHAR(12), field: 'api_key_prefix', allowNull: true })
  declare apiKeyPrefix: string | null;

  @Column({ type: DataType.STRING(45), field: 'source_ip', allowNull: true })
  declare sourceIp: string | null;

  @Column({ type: DataType.STRING(8), field: 'http_method', allowNull: false })
  declare httpMethod: string;

  @Column({ type: DataType.STRING(512), field: 'http_path', allowNull: false })
  declare httpPath: string;

  @Column({ type: DataType.INTEGER, field: 'http_status', allowNull: false })
  declare httpStatus: number;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare operation: string;

  @Column({
    type: DataType.STRING(64),
    field: 'resource_type',
    allowNull: false,
  })
  declare resourceType: string;

  @Column({
    type: DataType.STRING(128),
    field: 'resource_ref',
    allowNull: false,
  })
  declare resourceRef: string;

  @Column({
    type: DataType.STRING(64),
    field: 'interaction_ref',
    allowNull: true,
  })
  declare interactionRef: string | null;

  @Column({
    type: DataType.STRING(64),
    field: 'opportunity_ref',
    allowNull: true,
  })
  declare opportunityRef: string | null;

  @Column({
    type: DataType.STRING(256),
    field: 'idempotency_key',
    allowNull: true,
  })
  declare idempotencyKey: string | null;

  @Column({
    type: DataType.BOOLEAN,
    field: 'idempotent_replay',
    allowNull: false,
    defaultValue: false,
  })
  declare idempotentReplay: boolean;

  @Column({ type: DataType.STRING(96), field: 'if_match', allowNull: true })
  declare ifMatch: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(AuditOutcome)),
    allowNull: false,
  })
  declare outcome: AuditOutcome;

  @Column({ type: DataType.STRING(64), field: 'error_code', allowNull: true })
  declare errorCode: string | null;

  @Column({ type: DataType.CHAR(64), field: 'request_hash', allowNull: true })
  declare requestHash: string | null;

  @Column({ type: DataType.JSON, field: 'before_state', allowNull: true })
  declare beforeState: unknown;

  @Column({ type: DataType.JSON, field: 'after_state', allowNull: true })
  declare afterState: unknown;

  @Column({ type: DataType.INTEGER, field: 'latency_ms', allowNull: false })
  declare latencyMs: number;

  @Column({
    type: DataType.STRING(32),
    field: 'adapter_version',
    allowNull: true,
  })
  declare adapterVersion: string | null;

  @Column({ type: DataType.CHAR(64), field: 'prev_hash', allowNull: true })
  declare prevHash: string | null;

  @Column({ type: DataType.CHAR(64), field: 'entry_hash', allowNull: false })
  declare entryHash: string;

  @BeforeUpdate
  @BeforeDestroy
  static preventMutation(): never {
    throw new Error('mep_audit_log is append-only');
  }
}
