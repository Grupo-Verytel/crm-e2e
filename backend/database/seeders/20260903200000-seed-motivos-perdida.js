'use strict';

const crypto = require('crypto');

const MOTIVOS_PERDIDA = [
  {
    nombre: 'Precio / presupuesto',
    descripcion: 'La oferta no se ajustó al presupuesto del cliente.',
    requiere_detalle: false,
    orden: 10,
  },
  {
    nombre: 'Competidor ganador',
    descripcion: 'Otro proveedor cerró la oportunidad.',
    requiere_detalle: true,
    orden: 20,
  },
  {
    nombre: 'Sin decisión / aplazamiento',
    descripcion: 'El cliente aplazó o canceló la iniciativa.',
    requiere_detalle: true,
    orden: 30,
  },
  {
    nombre: 'Requisitos técnicos no cubiertos',
    descripcion: 'La solución no cumplió requisitos técnicos.',
    requiere_detalle: true,
    orden: 40,
  },
  {
    nombre: 'Relación / confianza',
    descripcion: 'Preferencia por otro proveedor por relación comercial.',
    requiere_detalle: false,
    orden: 50,
  },
  {
    nombre: 'Otro',
    descripcion: 'Otro motivo de pérdida.',
    requiere_detalle: true,
    orden: 90,
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      `SELECT nombre FROM motivos_perdida WHERE deleted_at IS NULL`,
    );
    const have = new Set(existing.map((r) => r.nombre));

    const rows = MOTIVOS_PERDIDA.filter((m) => !have.has(m.nombre)).map(
      (m) => ({
        motivo_id: crypto.randomUUID(),
        nombre: m.nombre,
        descripcion: m.descripcion,
        requiere_detalle: m.requiere_detalle,
        orden: m.orden,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }),
    );

    if (rows.length > 0) {
      await queryInterface.bulkInsert('motivos_perdida', rows);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('motivos_perdida', {
      nombre: MOTIVOS_PERDIDA.map((m) => m.nombre),
    });
  },
};
