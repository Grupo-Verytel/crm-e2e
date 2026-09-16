'use strict';

const OLD_SEGMENTOS = ['Gobierno', 'D&S', 'ProyectosEspeciales', 'B2B'];
const NEW_SEGMENTOS = [
  'Ciudades y gobernaciones',
  'Gobierno central',
  'Defensa y seguridad',
  'Industria',
];
const VALUE_MAP = [
  ['Gobierno', 'Gobierno central'],
  ['D&S', 'Defensa y seguridad'],
  ['ProyectosEspeciales', 'Ciudades y gobernaciones'],
  ['B2B', 'Industria'],
];
const CATALOG_RENAMES = [
  ['Gobierno', 'Gobierno central'],
  ['D&S', 'Defensa y seguridad'],
  ['Proyectos Especiales', 'Ciudades y gobernaciones'],
  ['B2B', 'Industria'],
];

async function replaceEnum(
  queryInterface,
  Sequelize,
  table,
  column,
  oldValues,
  newValues,
  mapping,
) {
  const combined = [...new Set([...oldValues, ...newValues])];
  await queryInterface.changeColumn(table, column, {
    type: Sequelize.ENUM(...combined),
    allowNull: false,
  });
  for (const [from, to] of mapping) {
    await queryInterface.sequelize.query(
      `UPDATE \`${table}\` SET \`${column}\` = :to WHERE \`${column}\` = :from`,
      { replacements: { from, to } },
    );
  }
  await queryInterface.changeColumn(table, column, {
    type: Sequelize.ENUM(...newValues),
    allowNull: false,
  });
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [from, to] of CATALOG_RENAMES) {
      await queryInterface.sequelize.query(
        `UPDATE segments
         SET name = :to, updated_at = NOW()
         WHERE name = :from AND deleted_at IS NULL`,
        { replacements: { from, to } },
      );
    }

    await replaceEnum(
      queryInterface,
      Sequelize,
      'leads',
      'segmento',
      OLD_SEGMENTOS,
      NEW_SEGMENTOS,
      VALUE_MAP,
    );
    await replaceEnum(
      queryInterface,
      Sequelize,
      'ouvs',
      'segmento',
      OLD_SEGMENTOS,
      NEW_SEGMENTOS,
      VALUE_MAP,
    );
    await replaceEnum(
      queryInterface,
      Sequelize,
      'campaigns',
      'segmento_objetivo',
      [...OLD_SEGMENTOS, 'Todos'],
      [...NEW_SEGMENTOS, 'Todos'],
      VALUE_MAP,
    );
  },

  async down(queryInterface, Sequelize) {
    const reverseMap = VALUE_MAP.map(([from, to]) => [to, from]);
    const reverseCatalog = CATALOG_RENAMES.map(([from, to]) => [to, from]);

    await replaceEnum(
      queryInterface,
      Sequelize,
      'leads',
      'segmento',
      NEW_SEGMENTOS,
      OLD_SEGMENTOS,
      reverseMap,
    );
    await replaceEnum(
      queryInterface,
      Sequelize,
      'ouvs',
      'segmento',
      NEW_SEGMENTOS,
      OLD_SEGMENTOS,
      reverseMap,
    );
    await replaceEnum(
      queryInterface,
      Sequelize,
      'campaigns',
      'segmento_objetivo',
      [...NEW_SEGMENTOS, 'Todos'],
      [...OLD_SEGMENTOS, 'Todos'],
      reverseMap,
    );

    for (const [to, from] of reverseCatalog) {
      await queryInterface.sequelize.query(
        `UPDATE segments
         SET name = :from, updated_at = NOW()
         WHERE name = :to AND deleted_at IS NULL`,
        { replacements: { from, to } },
      );
    }
  },
};
