'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('leads');

    for (const col of [
      'empresa_nombre',
      'contacto_nombre',
      'cargo',
      'email',
      'telefono',
    ]) {
      if (table[col]) {
        // eslint-disable-next-line no-await-in-loop
        await queryInterface.removeColumn('leads', col);
      }
    }

    // Keep leads.nit for now as optional legacy; DG-08 uses accounts.tax_id.
    // Spec removes contact copy fields only.

    await queryInterface.addColumn('leads', 'business_referrer_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      references: { model: 'users', key: 'user_id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('leads', 'segment_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      references: { model: 'segments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('leads', 'subsegment_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      references: { model: 'subsegments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('leads', ['business_referrer_id'], {
      name: 'leads_business_referrer_id_idx',
    });
    await queryInterface.addIndex('leads', ['segment_id'], {
      name: 'leads_segment_id_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('leads', 'leads_business_referrer_id_idx');
    await queryInterface.removeIndex('leads', 'leads_segment_id_idx');
    await queryInterface.removeColumn('leads', 'subsegment_id');
    await queryInterface.removeColumn('leads', 'segment_id');
    await queryInterface.removeColumn('leads', 'business_referrer_id');

    await queryInterface.addColumn('leads', 'empresa_nombre', {
      type: Sequelize.STRING(120),
      allowNull: false,
      defaultValue: '',
    });
    await queryInterface.addColumn('leads', 'contacto_nombre', {
      type: Sequelize.STRING(120),
      allowNull: false,
      defaultValue: '',
    });
    await queryInterface.addColumn('leads', 'cargo', {
      type: Sequelize.STRING(80),
      allowNull: true,
    });
    await queryInterface.addColumn('leads', 'email', {
      type: Sequelize.STRING(180),
      allowNull: false,
      defaultValue: '',
    });
    await queryInterface.addColumn('leads', 'telefono', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },
};
