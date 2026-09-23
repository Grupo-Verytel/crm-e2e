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
import { User } from '../../auth/models/user.model';
import { Sql } from '../../demand-generation/models/sql.model';
import {
  InteractionCanal,
  InteractionTipo,
} from '../../demand-generation/models/enums/interaction.enums';

@Table({
  tableName: 'sql_interactions',
  paranoid: true,
  timestamps: true,
  underscored: true,
})
export class SqlInteraction extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.CHAR(36), field: 'sql_interaction_id' })
  declare sqlInteractionId: string;

  @ForeignKey(() => Sql)
  @Column({ type: DataType.CHAR(36), field: 'sql_id', allowNull: false })
  declare sqlId: string;

  @BelongsTo(() => Sql)
  declare sql: Sql;

  @Column({
    type: DataType.ENUM(...Object.values(InteractionTipo)),
    allowNull: false,
  })
  declare tipo: InteractionTipo;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare subtipo: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(InteractionCanal)),
    allowNull: false,
  })
  declare canal: InteractionCanal;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare descripcion: string | null;

  @ForeignKey(() => User)
  @Column({
    type: DataType.CHAR(36),
    field: 'responsable_id',
    allowNull: false,
  })
  declare responsableId: string;

  @BelongsTo(() => User, { foreignKey: 'responsableId', as: 'responsable' })
  declare responsable: User;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, allowNull: false })
  declare fecha: Date;

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
