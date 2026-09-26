'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE commercial_opportunity
      SET status = CASE status
        WHEN 'OPEN' THEN 'EnCurso'
        WHEN 'WON' THEN 'Ganada'
        WHEN 'LOST' THEN 'Perdida'
        WHEN 'CANCELLED' THEN 'Descartada'
        ELSE status
      END
      WHERE status IS NOT NULL
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE commercial_opportunity
      MODIFY COLUMN status VARCHAR(32) NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE commercial_opportunity
      SET status = CASE status
        WHEN 'EnCurso' THEN 'OPEN'
        WHEN 'Ganada' THEN 'WON'
        WHEN 'Perdida' THEN 'LOST'
        WHEN 'Descartada' THEN 'CANCELLED'
        ELSE status
      END
      WHERE status IS NOT NULL
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE commercial_opportunity
      MODIFY COLUMN status ENUM('OPEN','WON','LOST','CANCELLED') NULL
    `);
  },
};
