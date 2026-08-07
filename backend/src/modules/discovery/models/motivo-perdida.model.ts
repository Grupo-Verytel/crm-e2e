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
  tableName: 'motivos_perdida',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class MotivoPerdida extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'motivo_id' })
  declare motivoId: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  declare nombre: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare descripcion: string | null;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    field: 'requiere_detalle',
    allowNull: false,
  })
  declare requiereDetalle: boolean;

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
