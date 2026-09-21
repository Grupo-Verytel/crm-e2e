'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const citas = await queryInterface.describeTable('sql_citas');

    if (!citas.graph_event_id) {
      await queryInterface.addColumn('sql_citas', 'graph_event_id', {
        type: Sequelize.STRING(512),
        allowNull: true,
      });
    }
    if (!citas.graph_organizer_upn) {
      await queryInterface.addColumn('sql_citas', 'graph_organizer_upn', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!citas.teams_join_url) {
      await queryInterface.addColumn('sql_citas', 'teams_join_url', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!citas.duration_minutes) {
      await queryInterface.addColumn('sql_citas', 'duration_minutes', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 60,
      });
    }
  },

  async down(queryInterface) {
    const citas = await queryInterface.describeTable('sql_citas');
    if (citas.duration_minutes) {
      await queryInterface.removeColumn('sql_citas', 'duration_minutes');
    }
    if (citas.teams_join_url) {
      await queryInterface.removeColumn('sql_citas', 'teams_join_url');
    }
    if (citas.graph_organizer_upn) {
      await queryInterface.removeColumn('sql_citas', 'graph_organizer_upn');
    }
    if (citas.graph_event_id) {
      await queryInterface.removeColumn('sql_citas', 'graph_event_id');
    }
  },
};
