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

@Table({
  tableName: 'process_types',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class ProcessType extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'process_type_id' })
  declare processTypeId: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  declare name: string;

  @Default(0)
  @Column({ type: DataType.INTEGER, field: 'sort_order', allowNull: false })
  declare sortOrder: number;

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
