'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('leads');

    if (!table.account_id) {
      await queryInterface.addColumn('leads', 'account_id', {
        type: Sequelize.CHAR(36),
        allowNull: true,
      });
      await queryInterface.addConstraint('leads', {
        fields: ['account_id'],
        type: 'foreign key',
        name: 'leads_account_id_fk',
        references: { table: 'accounts', field: 'account_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex('leads', ['account_id'], {
        name: 'leads_account_id_idx',
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE leads l
      INNER JOIN lead_contacts lc
        ON lc.lead_id = l.lead_id
        AND lc.position = 1
        AND lc.deleted_at IS NULL
      INNER JOIN people p
        ON p.person_id = lc.person_id
        AND p.deleted_at IS NULL
      SET l.account_id = p.account_id
      WHERE l.account_id IS NULL
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('leads');
    if (!table.account_id) {
      return;
    }

    await queryInterface.removeConstraint('leads', 'leads_account_id_fk');
    await queryInterface.removeIndex('leads', 'leads_account_id_idx');
    await queryInterface.removeColumn('leads', 'account_id');
  },
};
