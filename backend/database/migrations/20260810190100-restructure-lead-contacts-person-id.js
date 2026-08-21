'use strict';

/**
 * EARS-43: truncate contact bridges, then restructure lead_contacts with person_id.
 * Does NOT restructure ouv_contactos schema (truncate only).
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const isProduction = process.env.NODE_ENV === 'production';
    const allowTruncate = process.env.ALLOW_CONTACT_TRUNCATE === 'true';
    if (isProduction && !allowTruncate) {
      throw new Error(
        'Refusing to truncate lead_contacts/ouv_contactos in production without ALLOW_CONTACT_TRUNCATE=true (EARS-43 / R1)',
      );
    }

    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await queryInterface.sequelize.query('TRUNCATE TABLE `lead_contacts`');
    await queryInterface.sequelize.query('TRUNCATE TABLE `ouv_contactos`');
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    await queryInterface.addColumn('lead_contacts', 'person_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
    });

    await queryInterface.changeColumn('lead_contacts', 'person_id', {
      type: Sequelize.CHAR(36),
      allowNull: false,
    });

    await queryInterface.addConstraint('lead_contacts', {
      fields: ['person_id'],
      type: 'foreign key',
      name: 'lead_contacts_person_id_fk',
      references: { table: 'people', field: 'person_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.addIndex('lead_contacts', ['person_id'], {
      name: 'lead_contacts_person_id_idx',
    });

    for (const col of [
      'empresa_nombre',
      'nombre',
      'cargo',
      'email',
      'telefono',
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.removeColumn('lead_contacts', col);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(
      'lead_contacts',
      'lead_contacts_person_id_fk',
    );
    await queryInterface.removeIndex(
      'lead_contacts',
      'lead_contacts_person_id_idx',
    );
    await queryInterface.removeColumn('lead_contacts', 'person_id');

    await queryInterface.addColumn('lead_contacts', 'empresa_nombre', {
      type: Sequelize.STRING(120),
      allowNull: false,
      defaultValue: '',
    });
    await queryInterface.addColumn('lead_contacts', 'nombre', {
      type: Sequelize.STRING(120),
      allowNull: false,
      defaultValue: '',
    });
    await queryInterface.addColumn('lead_contacts', 'cargo', {
      type: Sequelize.STRING(80),
      allowNull: true,
    });
    await queryInterface.addColumn('lead_contacts', 'email', {
      type: Sequelize.STRING(180),
      allowNull: false,
      defaultValue: '',
    });
    await queryInterface.addColumn('lead_contacts', 'telefono', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },
};
