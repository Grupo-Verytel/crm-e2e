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
import { Kickoff } from './kickoff.model';

export type KickoffInviteeType = 'Interno' | 'ContactoOuv' | 'Externo';

/** Invitado confirmado del Kickoff (persona del tenant o contacto del cliente). */
@Table({
  tableName: 'kickoff_invitees',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class KickoffInvitee extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'kickoff_invitee_id' })
  declare kickoffInviteeId: string;

  @ForeignKey(() => Kickoff)
  @Column({ type: DataType.CHAR(36), field: 'kickoff_id', allowNull: false })
  declare kickoffId: string;

  @BelongsTo(() => Kickoff)
  declare kickoff: Kickoff;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare email: string;

  @Column({
    type: DataType.STRING(255),
    field: 'display_name',
    allowNull: false,
  })
  declare displayName: string;

  @Default('Interno')
  @Column({
    type: DataType.ENUM('Interno', 'ContactoOuv', 'Externo'),
    field: 'invitee_type',
    allowNull: false,
  })
  declare inviteeType: KickoffInviteeType;

  /**
   * Identificador de origen (person_id, contacto_ouv_id o el propio correo del
   * directorio). Permite que el frontend conserve la identidad del candidato.
   */
  @Column({
    type: DataType.STRING(255),
    field: 'source_ref',
    allowNull: true,
  })
  declare sourceRef: string | null;

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
