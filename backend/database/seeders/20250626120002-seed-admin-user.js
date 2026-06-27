'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const bcrypt = require('bcrypt');
const crypto = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const email = process.env.ADMIN_INITIAL_EMAIL;
    const password = process.env.ADMIN_INITIAL_PASSWORD;

    if (!email || !password) {
      console.log(
        'Skipping admin user seed: set ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD in backend/.env',
      );
      return;
    }

    const [roles] = await queryInterface.sequelize.query(
      "SELECT role_id FROM roles WHERE name = 'Admin' LIMIT 1",
    );

    if (!roles.length) {
      throw new Error('Admin role must be seeded before admin user');
    }

    const adminRoleId = roles[0].role_id;

    const [existing] = await queryInterface.sequelize.query(
      'SELECT user_id FROM users WHERE email = :email LIMIT 1',
      { replacements: { email: email.toLowerCase() } },
    );

    if (existing.length > 0) {
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        user_id: crypto.randomUUID(),
        email: email.toLowerCase(),
        password_hash: passwordHash,
        full_name: 'CRM Administrator',
        role_id: adminRoleId,
        is_active: true,
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
    const email = process.env.ADMIN_INITIAL_EMAIL;

    if (!email) {
      return;
    }

    await queryInterface.bulkDelete('users', {
      email: email.toLowerCase(),
    });
  },
};
