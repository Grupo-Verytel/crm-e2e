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
import { Subsegment } from './subsegment.model';

@Table({
  tableName: 'segments',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class Segment extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'id' })
  declare id: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare name: string;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare active: boolean;

  @HasMany(() => Subsegment, { foreignKey: 'segmentId', as: 'subsegments' })
  declare subsegments: Subsegment[];

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
