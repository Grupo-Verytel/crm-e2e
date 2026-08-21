'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('accounts', {
      account_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(160),
        allowNull: false,
      },
      tax_id: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('accounts', ['name'], {
      name: 'idx_accounts_name',
    });
    await queryInterface.addIndex('accounts', ['tax_id'], {
      name: 'idx_accounts_tax_id',
    });
    // Unicidad GC-04 (tax_id informado / name+tax_id) se refuerza en servicio
    // porque UNIQUE en MySQL choca con soft-delete (filas deleted_at siguen ocupando el índice).

    await queryInterface.createTable('people', {
      person_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      job_title: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(180),
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      account_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'accounts', key: 'account_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('people', ['account_id'], {
      name: 'idx_people_account_id',
    });
    await queryInterface.addIndex('people', ['name'], {
      name: 'idx_people_name',
    });
    await queryInterface.addIndex('people', ['email'], {
      name: 'idx_people_email',
    });
    // Unicidad GC-09 de email informado: servicio (misma razón soft-delete).
  },

  async down(queryInterface) {
    await queryInterface.dropTable('people');
    await queryInterface.dropTable('accounts');
  },
};
