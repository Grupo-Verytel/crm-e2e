'use strict';

/**
 * OUV Funnel v1.4 (5A): defensive truncate ouv_contactos, ADD person_id,
 * DROP denormalized columns; ADD ouvs.account_id (+ segment_id/subsegment_id).
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const isProduction = process.env.NODE_ENV === 'production';
    const allowTruncate = process.env.ALLOW_CONTACT_TRUNCATE === 'true';
    if (isProduction && !allowTruncate) {
      throw new Error(
        'Refusing to truncate ouv_contactos in production without ALLOW_CONTACT_TRUNCATE=true (5A / R1)',
      );
    }

    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await queryInterface.sequelize.query('TRUNCATE TABLE `ouv_contactos`');
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    const ouvContactCols = await queryInterface.describeTable('ouv_contactos');
    if (!ouvContactCols.person_id) {
      await queryInterface.addColumn('ouv_contactos', 'person_id', {
        type: Sequelize.CHAR(36),
        allowNull: true,
      });
      await queryInterface.changeColumn('ouv_contactos', 'person_id', {
        type: Sequelize.CHAR(36),
        allowNull: false,
      });
      await queryInterface.addConstraint('ouv_contactos', {
        fields: ['person_id'],
        type: 'foreign key',
        name: 'ouv_contactos_person_id_fk',
        references: { table: 'people', field: 'person_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      });
      await queryInterface.addIndex('ouv_contactos', ['person_id'], {
        name: 'ouv_contactos_person_id_idx',
      });
    }

    for (const col of ['nombre', 'cargo', 'email', 'telefono']) {
      if (ouvContactCols[col]) {
        // eslint-disable-next-line no-await-in-loop
        await queryInterface.removeColumn('ouv_contactos', col);
      }
    }

    const ouvCols = await queryInterface.describeTable('ouvs');

    if (!ouvCols.account_id) {
      await queryInterface.addColumn('ouvs', 'account_id', {
        type: Sequelize.CHAR(36),
        allowNull: true,
      });
      await queryInterface.addConstraint('ouvs', {
        fields: ['account_id'],
        type: 'foreign key',
        name: 'ouvs_account_id_fk',
        references: { table: 'accounts', field: 'account_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex('ouvs', ['account_id'], {
        name: 'ouvs_account_id_idx',
      });
    }

    if (!ouvCols.segment_id) {
      await queryInterface.addColumn('ouvs', 'segment_id', {
        type: Sequelize.CHAR(36),
        allowNull: true,
      });
      await queryInterface.addConstraint('ouvs', {
        fields: ['segment_id'],
        type: 'foreign key',
        name: 'ouvs_segment_id_fk',
        references: { table: 'segments', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!ouvCols.subsegment_id) {
      await queryInterface.addColumn('ouvs', 'subsegment_id', {
        type: Sequelize.CHAR(36),
        allowNull: true,
      });
      await queryInterface.addConstraint('ouvs', {
        fields: ['subsegment_id'],
        type: 'foreign key',
        name: 'ouvs_subsegment_id_fk',
        references: { table: 'subsegments', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const ouvCols = await queryInterface.describeTable('ouvs');
    if (ouvCols.subsegment_id) {
      await queryInterface.removeConstraint('ouvs', 'ouvs_subsegment_id_fk');
      await queryInterface.removeColumn('ouvs', 'subsegment_id');
    }
    if (ouvCols.segment_id) {
      await queryInterface.removeConstraint('ouvs', 'ouvs_segment_id_fk');
      await queryInterface.removeColumn('ouvs', 'segment_id');
    }
    if (ouvCols.account_id) {
      await queryInterface.removeConstraint('ouvs', 'ouvs_account_id_fk');
      await queryInterface.removeIndex('ouvs', 'ouvs_account_id_idx');
      await queryInterface.removeColumn('ouvs', 'account_id');
    }

    const contactCols = await queryInterface.describeTable('ouv_contactos');
    if (contactCols.person_id) {
      await queryInterface.removeConstraint(
        'ouv_contactos',
        'ouv_contactos_person_id_fk',
      );
      await queryInterface.removeIndex(
        'ouv_contactos',
        'ouv_contactos_person_id_idx',
      );
      await queryInterface.removeColumn('ouv_contactos', 'person_id');
    }

    if (!contactCols.nombre) {
      await queryInterface.addColumn('ouv_contactos', 'nombre', {
        type: Sequelize.STRING(120),
        allowNull: false,
        defaultValue: '',
      });
    }
    if (!contactCols.cargo) {
      await queryInterface.addColumn('ouv_contactos', 'cargo', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }
    if (!contactCols.email) {
      await queryInterface.addColumn('ouv_contactos', 'email', {
        type: Sequelize.STRING(180),
        allowNull: true,
      });
    }
    if (!contactCols.telefono) {
      await queryInterface.addColumn('ouv_contactos', 'telefono', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
  },
};
