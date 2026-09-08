'use strict';

/**
 * Corrige tres ENUM del expediente de venta ganada.
 *
 * La migración original inventó los valores en lugar de tomarlos del dominio
 * que ya usa el CRM, así que el backend rechazaba lo que enviaba la pantalla
 * («tipoVenta must be one of the following values…»):
 *
 * - `tipo_venta`: el CRM maneja Licitación y Venta directa, no una escala de
 *   Nueva/Renovación/Ampliación/Recompra.
 * - `envio_pmo_estado`: faltaba `Error`.
 * - `won_sale_alerts.estado`: faltaba `Pendiente`.
 */

const TIPO_VENTA_NUEVO = "ENUM('Licitacion','VentaDirecta') NOT NULL DEFAULT 'VentaDirecta'";
const TIPO_VENTA_VIEJO =
  "ENUM('Nueva','Renovacion','Ampliacion','Recompra') NOT NULL DEFAULT 'Nueva'";

const ENVIO_NUEVO =
  "ENUM('NoEnviado','Pendiente','Enviado','Rechazado','Error') NOT NULL DEFAULT 'NoEnviado'";
const ENVIO_VIEJO =
  "ENUM('NoEnviado','Pendiente','Enviado','Rechazado') NOT NULL DEFAULT 'NoEnviado'";

const ALERTA_NUEVO =
  "ENUM('Pendiente','Activa','Resuelta') NOT NULL DEFAULT 'Activa'";
const ALERTA_VIEJO = "ENUM('Activa','Resuelta') NOT NULL DEFAULT 'Activa'";

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
    if (!(await tableExists(queryInterface, 'won_sales'))) return;

    // Los valores viejos no existen en el ENUM nuevo: MySQL los convertiría en
    // cadena vacía. Se normalizan antes de tocar la definición de la columna.
    await queryInterface.sequelize.query(`
      UPDATE won_sales
      SET tipo_venta = 'VentaDirecta'
      WHERE tipo_venta NOT IN ('Licitacion', 'VentaDirecta')
    `);

    await queryInterface.sequelize.query(
      `ALTER TABLE won_sales MODIFY COLUMN tipo_venta ${TIPO_VENTA_NUEVO}`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE won_sales MODIFY COLUMN envio_pmo_estado ${ENVIO_NUEVO}`,
    );

    if (await tableExists(queryInterface, 'won_sale_alerts')) {
      await queryInterface.sequelize.query(
        `ALTER TABLE won_sale_alerts MODIFY COLUMN estado ${ALERTA_NUEVO}`,
      );
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, 'won_sales'))) return;

    if (await tableExists(queryInterface, 'won_sale_alerts')) {
      await queryInterface.sequelize.query(`
        UPDATE won_sale_alerts SET estado = 'Activa' WHERE estado = 'Pendiente'
      `);
      await queryInterface.sequelize.query(
        `ALTER TABLE won_sale_alerts MODIFY COLUMN estado ${ALERTA_VIEJO}`,
      );
    }

    await queryInterface.sequelize.query(`
      UPDATE won_sales SET envio_pmo_estado = 'Rechazado'
      WHERE envio_pmo_estado = 'Error'
    `);
    await queryInterface.sequelize.query(
      `ALTER TABLE won_sales MODIFY COLUMN envio_pmo_estado ${ENVIO_VIEJO}`,
    );

    await queryInterface.sequelize.query(`
      UPDATE won_sales SET tipo_venta = 'Nueva'
      WHERE tipo_venta NOT IN ('Nueva', 'Renovacion', 'Ampliacion', 'Recompra')
    `);
    await queryInterface.sequelize.query(
      `ALTER TABLE won_sales MODIFY COLUMN tipo_venta ${TIPO_VENTA_VIEJO}`,
    );
  },
};
