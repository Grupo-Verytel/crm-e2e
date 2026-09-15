'use strict';

const {
  BASE_ROLES,
  filterDirectorMercadeoPermissions,
  filterGestorMercadeoPermissions,
  normalizeRoleKey,
} = require('../seeders/lib/role-permissions');

function parsePermissions(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    return JSON.parse(value);
  }
  return [];
}

function mergePermissionRules(groups) {
  const seen = new Set();
  const merged = [];
  for (const rules of groups) {
    for (const rule of parsePermissions(rules)) {
      if (!rule || typeof rule.action !== 'string' || typeof rule.subject !== 'string') {
        continue;
      }
      const key = `${rule.action}::${rule.subject}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ action: rule.action, subject: rule.subject });
    }
  }
  return merged;
}

/**
 * Collapse roles that differ only by spaces (Director Mercadeo vs DirectorMercadeo).
 * Users move to the canonical PascalCase name; Director keeps only parameterizable modules.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const [roles] = await sequelize.query(
      'SELECT role_id, name, permissions FROM roles',
    );

    const canonicalByKey = new Map(
      BASE_ROLES.map((role) => [normalizeRoleKey(role.name), role.name]),
    );
    const groups = new Map();
    for (const role of roles) {
      const key = normalizeRoleKey(role.name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(role);
    }

    await sequelize.transaction(async (transaction) => {
      for (const [key, group] of groups.entries()) {
        if (group.length < 2 && !canonicalByKey.has(key)) {
          continue;
        }

        const canonicalName = canonicalByKey.get(key);
        let keeper =
          (canonicalName &&
            group.find((role) => role.name === canonicalName)) ||
          group[0];

        if (canonicalName && keeper.name !== canonicalName) {
          const taken = roles.some(
            (role) =>
              role.name === canonicalName && role.role_id !== keeper.role_id,
          );
          if (!taken) {
            await sequelize.query(
              'UPDATE roles SET name = :name WHERE role_id = :roleId',
              {
                replacements: { name: canonicalName, roleId: keeper.role_id },
                transaction,
              },
            );
            keeper = { ...keeper, name: canonicalName };
          }
        }

        const duplicates = group.filter(
          (role) => role.role_id !== keeper.role_id,
        );
        const merged = mergePermissionRules([
          keeper.permissions,
          ...duplicates.map((role) => role.permissions),
        ]);
        const normalizedKeeper = normalizeRoleKey(keeper.name);
        const permissions =
          normalizedKeeper === 'directormercadeo'
            ? filterDirectorMercadeoPermissions(merged)
            : normalizedKeeper === 'gestormercadeo'
              ? filterGestorMercadeoPermissions(merged)
              : merged;

        await sequelize.query(
          'UPDATE roles SET permissions = :permissions WHERE role_id = :roleId',
          {
            replacements: {
              permissions: JSON.stringify(permissions),
              roleId: keeper.role_id,
            },
            transaction,
          },
        );

        for (const duplicate of duplicates) {
          await sequelize.query(
            'UPDATE users SET role_id = :keeperId WHERE role_id = :duplicateId',
            {
              replacements: {
                keeperId: keeper.role_id,
                duplicateId: duplicate.role_id,
              },
              transaction,
            },
          );
          await sequelize.query('DELETE FROM roles WHERE role_id = :roleId', {
            replacements: { roleId: duplicate.role_id },
            transaction,
          });
        }
      }
    });
  },

  async down() {
    // Cannot restore deleted duplicate rows.
  },
};
