'use strict';

const FROM = 'Seguridad ciudadana';
const TO = 'Ciudades y gobernaciones';
const CURRENT = [
  'Seguridad ciudadana',
  'Gobierno central',
  'Defensa y seguridad',
  'Industria',
];
const NEXT = [
  'Ciudades y gobernaciones',
  'Gobierno central',
  'Defensa y seguridad',
  'Industria',
];

async function replaceEnum(
  queryInterface,
  Sequelize,
  table,
  column,
  oldValues,
  newValues,
  from,
  to,
) {
  const combined = [...new Set([...oldValues, ...newValues])];
  await queryInterface.changeColumn(table, column, {
    type: Sequelize.ENUM(...combined),
    allowNull: false,
  });
  await queryInterface.sequelize.query(
    `UPDATE \`${table}\` SET \`${column}\` = :to WHERE \`${column}\` = :from`,
    { replacements: { from, to } },
  );
  await queryInterface.changeColumn(table, column, {
    type: Sequelize.ENUM(...newValues),
    allowNull: false,
  });
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE segments
       SET name = :to, updated_at = NOW()
       WHERE name = :from AND deleted_at IS NULL`,
      { replacements: { from: FROM, to: TO } },
    );

    await replaceEnum(
      queryInterface,
      Sequelize,
      'leads',
      'segmento',
      CURRENT,
      NEXT,
      FROM,
      TO,
    );
    await replaceEnum(
      queryInterface,
      Sequelize,
      'ouvs',
      'segmento',
      CURRENT,
      NEXT,
      FROM,
      TO,
    );
    await replaceEnum(
      queryInterface,
      Sequelize,
      'campaigns',
      'segmento_objetivo',
      [...CURRENT, 'Todos'],
      [...NEXT, 'Todos'],
      FROM,
      TO,
    );
  },

  async down(queryInterface, Sequelize) {
    await replaceEnum(
      queryInterface,
      Sequelize,
      'leads',
      'segmento',
      NEXT,
      CURRENT,
      TO,
      FROM,
    );
    await replaceEnum(
      queryInterface,
      Sequelize,
      'ouvs',
      'segmento',
      NEXT,
      CURRENT,
      TO,
      FROM,
    );
    await replaceEnum(
      queryInterface,
      Sequelize,
      'campaigns',
      'segmento_objetivo',
      [...NEXT, 'Todos'],
      [...CURRENT, 'Todos'],
      TO,
      FROM,
    );

    await queryInterface.sequelize.query(
      `UPDATE segments
       SET name = :from, updated_at = NOW()
       WHERE name = :to AND deleted_at IS NULL`,
      { replacements: { from: FROM, to: TO } },
    );
  },
};
