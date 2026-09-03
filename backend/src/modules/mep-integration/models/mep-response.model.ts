import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { CommercialInteraction } from './commercial-interaction.model';
import { MepResponseVersion } from './mep-response-version.model';

/**
 * §8 `mep_response` — identidad estable del agregado de respuesta.
 *
 * INV-26 / P-09: un único `response_id` por interacción, generado una sola vez
 * por MEP y reutilizado en todos los hitos. No se deriva de un intento de
 * entrega ni cambia entre hitos.
 * `current_version` es el puntero a la última versión publicada; sirve para el
 * control de monotonía y para el `SELECT … FOR UPDATE` de §9.2.
 */
@Table({
  tableName: 'mep_response',
  timestamps: true,
  underscored: true,
})
export class MepResponse extends Model {
  @PrimaryKey
  @Column({ type: DataType.BIGINT, autoIncrement: true })
  declare id: string;

  @ForeignKey(() => CommercialInteraction)
  @Column({ type: DataType.BIGINT, field: 'interaction_id', allowNull: false })
  declare interactionId: string;

  @Column({
    type: DataType.STRING(128),
    field: 'response_id',
    allowNull: false,
    unique: true,
  })
  declare responseId: string;

  @Column({
    type: DataType.INTEGER,
    field: 'current_version',
    allowNull: false,
  })
  declare currentVersion: number;

  @Column({ type: DataType.STRING(96), allowNull: false })
  declare etag: string;

  @BelongsTo(() => CommercialInteraction)
  declare interaction: CommercialInteraction;

  @HasMany(() => MepResponseVersion)
  declare versions: MepResponseVersion[];
}
