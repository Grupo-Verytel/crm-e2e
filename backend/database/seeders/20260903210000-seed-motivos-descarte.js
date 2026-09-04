'use strict';

const crypto = require('crypto');

const MOTIVOS_DESCARTE = [
  {
    nombre: 'Fuera de ICP / segmento',
    descripcion: 'La oportunidad no encaja con el perfil comercial objetivo.',
    requiere_detalle: false,
    orden: 10,
  },
  {
    nombre: 'Duplicada',
    descripcion: 'Ya existe otra OUV o SQL para la misma oportunidad.',
    requiere_detalle: true,
    orden: 20,
  },
  {
    nombre: 'Datos insuficientes',
    descripcion: 'Falta información mínima para continuar el proceso.',
    requiere_detalle: true,
    orden: 30,
  },
  {
    nombre: 'Cliente no contactable',
    descripcion: 'No fue posible establecer contacto con el cliente.',
    requiere_detalle: false,
    orden: 40,
  },
  {
    nombre: 'Iniciativa cancelada por el cliente',
    descripcion: 'El cliente canceló la iniciativa antes de calificar.',
    requiere_detalle: false,
    orden: 50,
  },
  {
    nombre: 'Otro',
    descripcion: 'Otro motivo de descarte.',
    requiere_detalle: true,
    orden: 90,
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      `SELECT nombre FROM motivos_descarte WHERE deleted_at IS NULL`,
    );
    const have = new Set(existing.map((r) => r.nombre));

    const rows = MOTIVOS_DESCARTE.filter((m) => !have.has(m.nombre)).map(
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
      await queryInterface.bulkInsert('motivos_descarte', rows);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('motivos_descarte', {
      nombre: MOTIVOS_DESCARTE.map((m) => m.nombre),
    });
  },
};
