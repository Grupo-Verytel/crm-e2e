'use strict';

const crypto = require('crypto');

/** Demo profile rows for accounts list (sector, address, website). */
const DEMO_PROFILES = [
  {
    economic_sector: 'Manufactura',
    address: 'Calle 100 #15-20, Bogotá',
    website: 'https://www.molinos-demo.co',
  },
  {
    economic_sector: 'Telecomunicaciones',
    address: 'Av. El Dorado #68C-61, Bogotá',
    website: 'https://www.verytel-demo.com',
  },
  {
    economic_sector: 'Servicios financieros',
    address: 'Carrera 7 #71-21, Bogotá',
    website: 'https://www.banco-ejemplo.com.co',
  },
  {
    economic_sector: 'Comercio mayorista',
    address: 'Zona Industrial Puente Aranda, Bogotá',
    website: 'https://www.distribuidora-demo.co',
  },
  {
    economic_sector: 'Tecnología',
    address: 'Carrera 11 #93-07, Bogotá',
    website: 'https://www.software-demo.io',
  },
  {
    economic_sector: 'Construcción',
    address: 'Calle 26 #69-76, Bogotá',
    website: 'https://www.obras-demo.com.co',
  },
];

const DEMO_ACCOUNTS = [
  {
    name: 'Molinos Arman',
    tax_id: '900123456-1',
    ...DEMO_PROFILES[0],
  },
  {
    name: 'Grupo Verytel Demo',
    tax_id: '900987654-3',
    ...DEMO_PROFILES[1],
  },
  {
    name: 'Finanzas Andinas SAS',
    tax_id: '901555444-2',
    ...DEMO_PROFILES[2],
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    for (const demo of DEMO_ACCOUNTS) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT account_id FROM accounts
         WHERE deleted_at IS NULL
           AND (name = :name OR (tax_id IS NOT NULL AND tax_id = :taxId))
         LIMIT 1`,
        { replacements: { name: demo.name, taxId: demo.tax_id } },
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('accounts', [
          {
            account_id: crypto.randomUUID(),
            name: demo.name,
            tax_id: demo.tax_id,
            economic_sector: demo.economic_sector,
            address: demo.address,
            website: demo.website,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          },
        ]);
      } else {
        await queryInterface.sequelize.query(
          `UPDATE accounts SET
             economic_sector = COALESCE(economic_sector, :economic_sector),
             address = COALESCE(address, :address),
             website = COALESCE(website, :website),
             updated_at = :now
           WHERE account_id = :accountId`,
          {
            replacements: {
              accountId: existing[0].account_id,
              economic_sector: demo.economic_sector,
              address: demo.address,
              website: demo.website,
              now,
            },
          },
        );
      }
    }

    const [rows] = await queryInterface.sequelize.query(
      `SELECT account_id FROM accounts
       WHERE deleted_at IS NULL
         AND (economic_sector IS NULL OR address IS NULL OR website IS NULL)
       ORDER BY name ASC`,
    );

    for (let i = 0; i < rows.length; i += 1) {
      const profile = DEMO_PROFILES[i % DEMO_PROFILES.length];
      await queryInterface.sequelize.query(
        `UPDATE accounts SET
           economic_sector = COALESCE(economic_sector, :economic_sector),
           address = COALESCE(address, :address),
           website = COALESCE(website, :website),
           updated_at = :now
         WHERE account_id = :accountId`,
        {
          replacements: {
            accountId: rows[i].account_id,
            economic_sector: profile.economic_sector,
            address: profile.address,
            website: profile.website,
            now,
          },
        },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE accounts SET
         economic_sector = NULL,
         address = NULL,
         website = NULL,
         updated_at = NOW()
       WHERE name IN (:names)`,
      {
        replacements: {
          names: DEMO_ACCOUNTS.map((a) => a.name),
        },
      },
    );

    await queryInterface.bulkDelete('accounts', {
      name: DEMO_ACCOUNTS.map((a) => a.name),
    });
  },
};
