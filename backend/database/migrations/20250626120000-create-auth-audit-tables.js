'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      role_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(60),
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.STRING(160),
        allowNull: true,
      },
      permissions: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      is_system: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    });

    await queryInterface.createTable('users', {
      user_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(180),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      full_name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      role_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'roles',
          key: 'role_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      failed_login_attempts: {
        type: Sequelize.SMALLINT,
        allowNull: false,
        defaultValue: 0,
      },
      locked_until: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
        ),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('users', ['role_id'], {
      name: 'idx_users_role_id',
    });

    await queryInterface.createTable('refresh_tokens', {
      token_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      token_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('refresh_tokens', ['user_id'], {
      name: 'idx_refresh_tokens_user_id',
    });

    await queryInterface.createTable('audit_log', {
      audit_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      tabla: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      registro_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
      },
      accion: {
        type: Sequelize.ENUM(
          'INSERT',
          'UPDATE',
          'DELETE',
          'STATE_CHANGE',
          'LOGIN',
          'EXPORT',
        ),
        allowNull: false,
      },
      campo_modificado: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      valor_anterior: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      valor_nuevo: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      usuario_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: false,
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      contexto: {
        type: Sequelize.JSON,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('audit_log', ['tabla'], {
      name: 'idx_audit_log_tabla',
    });
    await queryInterface.addIndex('audit_log', ['registro_id'], {
      name: 'idx_audit_log_registro_id',
    });
    await queryInterface.addIndex('audit_log', ['usuario_id'], {
      name: 'idx_audit_log_usuario_id',
    });
    await queryInterface.addIndex('audit_log', ['accion'], {
      name: 'idx_audit_log_accion',
    });
    await queryInterface.addIndex('audit_log', ['timestamp'], {
      name: 'idx_audit_log_timestamp',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_log');
    await queryInterface.dropTable('refresh_tokens');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('roles');
  },
};
