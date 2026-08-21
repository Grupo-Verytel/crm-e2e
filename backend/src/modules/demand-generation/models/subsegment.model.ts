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
import { Segment } from './segment.model';

@Table({
  tableName: 'subsegments',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class Subsegment extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'id' })
  declare id: string;

  @ForeignKey(() => Segment)
  @Column({ type: DataType.CHAR(36), field: 'segment_id', allowNull: false })
  declare segmentId: string;

  @BelongsTo(() => Segment)
  declare segment: Segment;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare name: string;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare active: boolean;

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
