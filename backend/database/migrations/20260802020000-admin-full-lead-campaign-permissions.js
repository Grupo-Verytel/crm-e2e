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
    // Previous Admin matrix: read-only on commercial subjects + CRUA on users/roles.
    const previous = [
      { action: 'create', subject: 'User' },
      { action: 'read', subject: 'User' },
      { action: 'update', subject: 'User' },
      { action: 'approve', subject: 'User' },
      { action: 'create', subject: 'Role' },
      { action: 'read', subject: 'Role' },
      { action: 'update', subject: 'Role' },
      { action: 'approve', subject: 'Role' },
      { action: 'read', subject: 'Lead' },
      { action: 'read', subject: 'Campaign' },
      { action: 'read', subject: 'Opportunity' },
      { action: 'read', subject: 'Presale' },
      { action: 'read', subject: 'Pricing' },
      { action: 'read', subject: 'Proposal' },
      { action: 'read', subject: 'Contract' },
      { action: 'read', subject: 'Service' },
      { action: 'read', subject: 'Billing' },
      { action: 'read', subject: 'PostSale' },
      { action: 'read', subject: 'AuditLog' },
    ];

    await queryInterface.bulkUpdate(
      'roles',
      { permissions: JSON.stringify(previous) },
      { name: 'Admin' },
    );
  },
};
