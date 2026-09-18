'use strict';

/**
 * Preventa (y el rol de cargo «Ingeniero Preventa»): OUV solo lectura.
 *
 * Las solicitudes de preventa se consultan dentro del detalle de la OUV; crear
 * una exige `update Opportunity`, que es del comercial dueño. Se quitan
 * Empresas/Contactos, Presale, Pricing, Kickoff, WonSale y Oferta, igual que
 * en la rama `Design_JD` (migraciones `lock-preventa-permissions` y
 * `lock-ingeniero-preventa-permissions`).
 *
 * El nombre se compara compacto (sin espacios, `_` ni `-`, en minúsculas),
 * como `compactRoleName` en backend y frontend.
 */

const ROLE_KEYS = ['preventa', 'ingenieropreventa'];

const LOCKED_PERMISSIONS = [{ action: 'read', subject: 'Opportunity' }];

/** Matriz anterior de Preventa en `seeders/lib/role-permissions.js`. */
const PREVIOUS_PERMISSIONS = [
  { action: 'read', subject: 'Opportunity' },
  { action: 'create', subject: 'Account' },
  { action: 'read', subject: 'Account' },
  { action: 'update', subject: 'Account' },
  { action: 'create', subject: 'Person' },
  { action: 'read', subject: 'Person' },
  { action: 'update', subject: 'Person' },
  { action: 'create', subject: 'Presale' },
  { action: 'read', subject: 'Presale' },
  { action: 'update', subject: 'Presale' },
  { action: 'approve', subject: 'Presale' },
  { action: 'read', subject: 'Pricing' },
  { action: 'read', subject: 'Kickoff' },
  { action: 'read', subject: 'WonSale' },
  { action: 'read', subject: 'Proposal' },
  { action: 'read', subject: 'Contract' },
];

const COMPACT_NAME_SQL =
  "LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', ''))";

async function setPermissions(queryInterface, permissions) {
  await queryInterface.sequelize.query(
    `UPDATE roles SET permissions = :permissions
     WHERE ${COMPACT_NAME_SQL} IN (:roleKeys)`,
    {
      replacements: {
        permissions: JSON.stringify(permissions),
        roleKeys: ROLE_KEYS,
      },
    },
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await setPermissions(queryInterface, LOCKED_PERMISSIONS);
  },

  async down(queryInterface) {
    await setPermissions(queryInterface, PREVIOUS_PERMISSIONS);
  },
};
