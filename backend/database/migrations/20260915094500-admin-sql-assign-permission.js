'use strict';

/**
 * Admin needs assign::Sql now that assignment is a distinct CASL action.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const [rows] = await sequelize.query(
      `SELECT role_id, permissions FROM roles
       WHERE LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '_', ''), '-', '')) = 'admin'`,
    );
    for (const row of rows) {
      let permissions = row.permissions;
      if (typeof permissions === 'string' && permissions.trim()) {
        permissions = JSON.parse(permissions);
      }
      if (!Array.isArray(permissions)) {
        continue;
      }
      const hasAssign = permissions.some(
        (rule) => rule && rule.action === 'assign' && rule.subject === 'Sql',
      );
      if (hasAssign) {
        continue;
      }
      permissions.push({ action: 'assign', subject: 'Sql' });
      await sequelize.query(
        `UPDATE roles SET permissions = :permissions WHERE role_id = :roleId`,
        {
          replacements: {
            permissions: JSON.stringify(permissions),
            roleId: row.role_id,
          },
        },
      );
    }
  },

  async down() {
    // Non-destructive.
  },
};
