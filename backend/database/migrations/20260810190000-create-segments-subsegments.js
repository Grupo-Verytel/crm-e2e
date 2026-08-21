'use strict';

const crypto = require('crypto');

const SEGMENT_NAMES = ['Gobierno', 'D&S', 'Proyectos Especiales', 'B2B'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('segments', {
      id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.createTable('subsegments', {
      id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        primaryKey: true,
      },
      segment_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'segments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('subsegments', ['segment_id'], {
      name: 'subsegments_segment_id_idx',
    });

    const now = new Date();
    await queryInterface.bulkInsert(
      'segments',
      SEGMENT_NAMES.map((name) => ({
        id: crypto.randomUUID(),
        name,
        active: true,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('subsegments');
    await queryInterface.dropTable('segments');
  },
};
