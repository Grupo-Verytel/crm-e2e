import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { User } from '../../auth/models/user.model';
import { OuvZona } from './enums/ouv.enums';
import { Ouv } from './ouv.model';

/** Checklist item seeded from zona_checklist_templates (T3 with timestamp). */
@Table({
  tableName: 'ouv_checklist_items',
  timestamps: true,
  updatedAt: false,
  underscored: true,
})
export class OuvChecklistItem extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'item_id' })
  declare itemId: string;

  @ForeignKey(() => Ouv)
  @Column({ type: DataType.CHAR(36), field: 'ouv_id', allowNull: false })
  declare ouvId: string;

  @BelongsTo(() => Ouv, { foreignKey: 'ouvId', as: 'ouv' })
  declare ouv: Ouv;

  @Column({
    type: DataType.ENUM(...Object.values(OuvZona)),
    allowNull: false,
  })
  declare zona: OuvZona;

  @Column({
    type: DataType.STRING(60),
    field: 'codigo_item',
    allowNull: false,
  })
  declare codigoItem: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  declare label: string;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare marcado: boolean;

  @Column({ type: DataType.DATE, field: 'marcado_at', allowNull: true })
  declare marcadoAt: Date | null;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'marcado_por',
    allowNull: true,
  })
  declare marcadoPor: string | null;

  @BelongsTo(() => User, { foreignKey: 'marcadoPor', as: 'marcadoPorUser' })
  declare marcadoPorUser: User | null;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;
}
