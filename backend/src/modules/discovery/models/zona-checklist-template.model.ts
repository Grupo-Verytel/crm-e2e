import {
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { OuvZona } from './enums/ouv.enums';

@Table({
  tableName: 'zona_checklist_templates',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class ZonaChecklistTemplate extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'template_id' })
  declare templateId: string;

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

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare orden: number;

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
