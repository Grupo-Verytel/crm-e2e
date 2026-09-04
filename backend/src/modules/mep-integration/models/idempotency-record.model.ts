import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export enum IdempotencyStatus {
  IN_FLIGHT = 'IN_FLIGHT',
  COMPLETED = 'COMPLETED',
}

/**
 * §9.1 `idempotency_record` — reserva y replay de `Idempotency-Key`.
 *
 * INV-28: la clave se reserva IN_FLIGHT antes de ejecutar la lógica de negocio
 * y se completa dentro de la misma transacción que la mutación.
 * INV-29: un replay devuelve la respuesta guardada sin ejecutar la lógica, por
 * lo que `response_version` no avanza.
 * Retención: 7 días (`expires_at` + job de purga).
 */
@Table({
  tableName: 'idempotency_record',
  timestamps: true,
  updatedAt: false,
  underscored: true,
})
export class IdempotencyRecord extends Model {
  @PrimaryKey
  @Column({ type: DataType.BIGINT, autoIncrement: true })
  declare id: string;

  @Column({ type: DataType.BIGINT, field: 'api_key_id', allowNull: false })
  declare apiKeyId: string;

  @Column({ type: DataType.STRING(8), allowNull: false })
  declare method: string;

  @Column({ type: DataType.STRING(512), allowNull: false })
  declare path: string;

  @Column({
    type: DataType.STRING(256),
    field: 'idempotency_key',
    allowNull: false,
  })
  declare idempotencyKey: string;

  @Column({ type: DataType.CHAR(64), field: 'request_hash', allowNull: false })
  declare requestHash: string;

  @Column({
    type: DataType.ENUM(...Object.values(IdempotencyStatus)),
    allowNull: false,
  })
  declare status: IdempotencyStatus;

  @Column({
    type: DataType.INTEGER,
    field: 'response_status',
    allowNull: true,
  })
  declare responseStatus: number | null;

  @Column({
    type: DataType.TEXT('medium'),
    field: 'response_body',
    allowNull: true,
  })
  declare responseBody: string | null;

  @Column({
    type: DataType.STRING(96),
    field: 'response_etag',
    allowNull: true,
  })
  declare responseEtag: string | null;

  @Column({ type: DataType.DATE(3), field: 'expires_at', allowNull: false })
  declare expiresAt: Date;
}
