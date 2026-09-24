'use strict';

/**
 * Reuse `interactions` for SQL detail. sql_id is nullable: historical rows
 * stay NULL (etapa Previa). Author remains responsable_id.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('interactions', 'sql_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      references: { model: 'sqls', key: 'sql_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await queryInterface.addIndex('interactions', ['sql_id'], {
      name: 'idx_interactions_sql_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('interactions', 'idx_interactions_sql_id');
    await queryInterface.removeColumn('interactions', 'sql_id');
  },
};
