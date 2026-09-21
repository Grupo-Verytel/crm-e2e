'use strict';

const crypto = require('crypto');

const PERIOD_TYPES = ['annual', 'quarter', 'biweekly', 'weekly'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('marketing_dashboard_targets', {
      target_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        primaryKey: true,
      },
      period_type: {
        type: Sequelize.ENUM(...PERIOD_TYPES),
        allowNull: false,
        unique: true,
      },
      interactions: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 50,
      },
      period_leads: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      converted_ouvs: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
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

    const now = new Date();
    await queryInterface.bulkInsert(
      'marketing_dashboard_targets',
      PERIOD_TYPES.map((periodType) => ({
        target_id: crypto.randomUUID(),
        period_type: periodType,
        interactions: 50,
        period_leads: 3,
        converted_ouvs: 3,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('marketing_dashboard_targets');
  },
};
