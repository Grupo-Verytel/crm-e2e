'use strict';

const crypto = require('crypto');

const MOTIVOS_PERDIDA = [
  { nombre: 'Precio', orden: 1, requiere_detalle: false },
  { nombre: 'Ganó competidor', orden: 2, requiere_detalle: false },
  { nombre: 'Sin presupuesto', orden: 3, requiere_detalle: false },
  { nombre: 'Timing / no es el momento', orden: 4, requiere_detalle: false },
  { nombre: 'Alcance o solución no encaja', orden: 5, requiere_detalle: false },
  { nombre: 'Proceso de compra detenido', orden: 6, requiere_detalle: false },
  { nombre: 'Relación / confianza', orden: 7, requiere_detalle: false },
  { nombre: 'Otro', orden: 99, requiere_detalle: true },
];

const CATALOG_READ = [
  { action: 'read', subject: 'MotivoPerdida' },
  { action: 'read', subject: 'MotivoDescarte' },
];

const CATALOG_CRUD = [
  { action: 'read', subject: 'MotivoPerdida' },
  { action: 'create', subject: 'MotivoPerdida' },
  { action: 'update', subject: 'MotivoPerdida' },
  { action: 'delete', subject: 'MotivoPerdida' },
  { action: 'read', subject: 'MotivoDescarte' },
  { action: 'create', subject: 'MotivoDescarte' },
  { action: 'update', subject: 'MotivoDescarte' },
  { action: 'delete', subject: 'MotivoDescarte' },
];

const ROLE_RULES = {
  EjecutivoComercial: CATALOG_READ,
  Admin: CATALOG_CRUD,
  SoporteComercial: CATALOG_CRUD,
};

function hasRule(permissions, rule) {
  return permissions.some(
    (p) => p.action === rule.action && p.subject === rule.subject,
  );
}

function parsePermissions(raw) {
  const permissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(permissions) ? permissions : [];
}

async function tableExists(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS cnt
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
    `,
    { replacements: { table } },
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    if (await tableExists(queryInterface, 'motivos_perdida')) {
      const [countRows] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) AS cnt FROM motivos_perdida WHERE deleted_at IS NULL`,
      );
      if (Number(countRows[0]?.cnt ?? 0) === 0) {
        const now = new Date();
        await queryInterface.bulkInsert(
          'motivos_perdida',
          MOTIVOS_PERDIDA.map((row) => ({
            motivo_id: crypto.randomUUID(),
            nombre: row.nombre,
            descripcion: null,
            requiere_detalle: row.requiere_detalle,
            orden: row.orden,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          })),
        );
      }
    }

    const roleNames = Object.keys(ROLE_RULES);
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles WHERE name IN (:names)`,
      { replacements: { names: roleNames } },
    );

    for (const role of roles) {
      const rules = ROLE_RULES[role.name] || [];
      const permissions = parsePermissions(role.permissions);
      let changed = false;
      for (const rule of rules) {
        if (!hasRule(permissions, rule)) {
          permissions.push(rule);
          changed = true;
        }
      }
      if (changed) {
        await queryInterface.sequelize.query(
          `UPDATE roles SET permissions = :permissions WHERE role_id = :roleId`,
          {
            replacements: {
              permissions: JSON.stringify(permissions),
              roleId: role.role_id,
            },
          },
        );
      }
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'motivos_perdida')) {
      const nombres = MOTIVOS_PERDIDA.map((row) => row.nombre);
      await queryInterface.bulkDelete('motivos_perdida', {
        nombre: nombres,
      });
    }

    const roleNames = Object.keys(ROLE_RULES);
    const [roles] = await queryInterface.sequelize.query(
      `SELECT role_id, name, permissions FROM roles WHERE name IN (:names)`,
      { replacements: { names: roleNames } },
    );

    for (const role of roles) {
      const rules = ROLE_RULES[role.name] || [];
      const permissions = parsePermissions(role.permissions);
      const next = permissions.filter(
        (p) =>
          !rules.some((r) => r.action === p.action && r.subject === p.subject),
      );
      if (next.length !== permissions.length) {
        await queryInterface.sequelize.query(
          `UPDATE roles SET permissions = :permissions WHERE role_id = :roleId`,
          {
            replacements: {
              permissions: JSON.stringify(next),
              roleId: role.role_id,
            },
          },
        );
      }
    }
  },
};
