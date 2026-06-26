'use strict';

const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001';
const SYSTEM_USER_EMAIL = 'system@crm.internal';
/** Placeholder bcrypt hash — login disabled for system actor (is_active=false). */
const PASSWORD_HASH =
  '$2b$10$W012345678901234567890uABCDEFGHIJKLMNOPQRSTUVWXYZ012';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      "SELECT role_id FROM roles WHERE name = 'Admin' LIMIT 1",
    );

    if (!roles.length) {
      throw new Error('Admin role must be seeded before system user');
    }

    const adminRoleId = roles[0].role_id;

    const [existing] = await queryInterface.sequelize.query(
      'SELECT user_id FROM users WHERE user_id = :userId OR email = :email LIMIT 1',
      {
        replacements: {
          userId: SYSTEM_USER_ID,
          email: SYSTEM_USER_EMAIL,
        },
      },
    );

    if (existing.length > 0) {
      return;
    }

    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        user_id: SYSTEM_USER_ID,
        email: SYSTEM_USER_EMAIL,
        password_hash: PASSWORD_HASH,
        full_name: 'System Actor',
        role_id: adminRoleId,
        is_active: false,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      user_id: SYSTEM_USER_ID,
    });
  },
};
