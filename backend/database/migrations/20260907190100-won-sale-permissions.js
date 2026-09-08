'use strict';

/**
 * Reglas CASL del subject `WonSale`.
 *
 * El seeder de roles solo corre en base nueva; esta migración añade las reglas
 * a los roles ya existentes sin tocar el resto de sus permisos.
 *
 * Mismo reparto que `Kickoff`: es la misma pantalla y los mismos actores.
 * Quién diligencia: EjecutivoComercial (dueño de la OUV) y SoporteComercial.
 * Quién solo consulta: PMO (recibe el proyecto) y los roles que ya leen
 * `Opportunity` — DirectorMercadeo, Preventa y Pricing. Admin conserva todo.
 */

const RULES_BY_ROLE = {
  Admin: ['create', 'read', 'update', 'delete'],
  EjecutivoComercial: ['create', 'read', 'update'],
  SoporteComercial: ['create', 'read', 'update', 'delete'],
  PMO: ['read'],
  Preventa: ['read'],
  DirectorMercadeo: ['read'],
  Pricing: ['read'],
};

const SUBJECT = 'WonSale';

function parsePermissions(raw) {
  const permissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(permissions) ? permissions : [];
}

async function writePermissions(queryInterface, roleId, permissions) {
  await queryInterface.sequelize.query(
    `UPDATE roles SET permissions = :permissions WHERE role_id = :roleId`,
    {
      replacements: {
        permissions: JSON.stringify(permissions),
        roleId,
      },
    },
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles`,
    );

    for (const role of roles) {
      const actions = RULES_BY_ROLE[role.name];
      if (!actions) continue;

      const permissions = parsePermissions(role.permissions);
      let changed = false;

      for (const action of actions) {
        const exists = permissions.some(
          (p) => p.action === action && p.subject === SUBJECT,
        );
        if (!exists) {
          permissions.push({ action, subject: SUBJECT });
          changed = true;
        }
      }

      if (changed) {
        await writePermissions(queryInterface, role.role_id, permissions);
      }
    }
  },

  async down(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles`,
    );

    for (const role of roles) {
      if (!RULES_BY_ROLE[role.name]) continue;

      const permissions = parsePermissions(role.permissions);
      const filtered = permissions.filter((p) => p.subject !== SUBJECT);

      if (filtered.length !== permissions.length) {
        await writePermissions(queryInterface, role.role_id, filtered);
      }
    }
  },
};
