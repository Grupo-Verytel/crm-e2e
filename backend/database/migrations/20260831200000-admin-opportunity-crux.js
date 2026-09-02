'use strict';

const { buildPermissions } = require('../seeders/lib/role-permissions');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const permissions = JSON.stringify(buildPermissions('Admin'));

    await queryInterface.bulkUpdate(
      'roles',
      { permissions },
      { name: 'Admin' },
    );
  },

  async down(queryInterface) {
    // Revert Admin opportunities to read-only (pre-CRUX matrix for Opportunity).
    const previous = buildPermissions('Admin').map((rule) =>
      rule.subject === 'Opportunity' && rule.action !== 'read'
        ? null
        : rule,
    ).filter(Boolean);

    // Ensure Opportunity read remains if filter removed create/update/close.
    const hasOpportunityRead = previous.some(
      (r) => r.subject === 'Opportunity' && r.action === 'read',
    );
    if (!hasOpportunityRead) {
      previous.push({ action: 'read', subject: 'Opportunity' });
    }

    await queryInterface.bulkUpdate(
      'roles',
      { permissions: JSON.stringify(previous) },
      { name: 'Admin' },
    );
  },
};
