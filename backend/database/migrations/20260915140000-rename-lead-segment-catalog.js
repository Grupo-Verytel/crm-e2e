'use strict';

const RENAMES = [
  ['Gobierno', 'Gobierno central'],
  ['D&S', 'Defensa y seguridad'],
  ['Proyectos Especiales', 'Ciudades y gobernaciones'],
  ['B2B', 'Industria'],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const [from, to] of RENAMES) {
      await queryInterface.sequelize.query(
        `UPDATE segments
         SET name = :to, updated_at = NOW()
         WHERE name = :from AND deleted_at IS NULL`,
        { replacements: { from, to } },
      );
    }
  },

  async down(queryInterface) {
    for (const [from, to] of RENAMES) {
      await queryInterface.sequelize.query(
        `UPDATE segments
         SET name = :from, updated_at = NOW()
         WHERE name = :to AND deleted_at IS NULL`,
        { replacements: { from, to } },
      );
    }
  },
};
