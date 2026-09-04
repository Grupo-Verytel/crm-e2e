import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export enum ApiKeyEnvironment {
  sandbox = 'sandbox',
  staging = 'staging',
  production = 'production',
}

/**
 * §10.1 `api_key` — service account no humano de la integración.
 *
 * En BD solo vive el **hash** de la clave; el valor claro existe una sola vez,
 * en el momento de emisión, y jamás entra en payloads, logs ni Git.
 * `key_prefix` (12 chars) identifica la clave en logs y auditoría sin
 * exponerla. Soporta rotación (dos claves activas por identidad) y revocación
 * inmediata (`revoked_at`, cache TTL ≤ 60 s).
 *
 * Tabla propia de la integración: no se mezcla con `users`/`roles` del CRM,
 * porque la identidad MEP no es un usuario nominal (OPEN-05).
 */
@Table({
  tableName: 'mep_api_key',
  timestamps: true,
  updatedAt: false,
  underscored: true,
})
export class MepApiKey extends Model {
  @PrimaryKey
  @Column({ type: DataType.BIGINT, autoIncrement: true })
  declare id: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare identity: string;

  @Column({
    type: DataType.ENUM(...Object.values(ApiKeyEnvironment)),
    allowNull: false,
  })
  declare environment: ApiKeyEnvironment;

  @Column({
    type: DataType.CHAR(12),
    field: 'key_prefix',
    allowNull: false,
    unique: true,
  })
  declare keyPrefix: string;

  @Column({ type: DataType.STRING(255), field: 'key_hash', allowNull: false })
  declare keyHash: string;

  @Column({ type: DataType.JSON, allowNull: false })
  declare scopes: string[];

  @Column({ type: DataType.STRING(32), field: 'rate_tier', allowNull: false })
  declare rateTier: string;

  @Column({ type: DataType.DATE(3), field: 'expires_at', allowNull: false })
  declare expiresAt: Date;

  @Column({ type: DataType.DATE(3), field: 'revoked_at', allowNull: true })
  declare revokedAt: Date | null;

  @Column({ type: DataType.DATE(3), field: 'last_used_at', allowNull: true })
  declare lastUsedAt: Date | null;
}
