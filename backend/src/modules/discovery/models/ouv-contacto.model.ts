import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { OuvInfluencia } from './ouv-influencia.model';
import { Ouv } from './ouv.model';

/**
 * Contact bridge for an OUV — person_id reuses people (accounts module).
 * PK contacto_ouv_id kept so ouv_influencias.contacto_ouv_id stays unchanged.
 */
@Table({
  tableName: 'ouv_contactos',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class OuvContacto extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'contacto_ouv_id' })
  declare contactoOuvId: string;

  @ForeignKey(() => Ouv)
  @Column({ type: DataType.CHAR(36), field: 'ouv_id', allowNull: false })
  declare ouvId: string;

  @BelongsTo(() => Ouv, { foreignKey: 'ouvId', as: 'ouv' })
  declare ouv: Ouv;

  @Column({
    type: DataType.CHAR(36),
    field: 'person_id',
    allowNull: false,
  })
  declare personId: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare notas: string | null;

  @HasMany(() => OuvInfluencia, {
    foreignKey: 'contactoOuvId',
    as: 'influencias',
  })
  declare influencias: OuvInfluencia[];

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
