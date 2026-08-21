'use strict';

/**
 * PASO 1 / migration 1 of 8 — add funnel columns to `ouvs` (spec-ouv-funnel v1.2 §2.1).
 * Does NOT include Wave 2 fields (zona_antes_cierre, override_*, motivo_reapertura_*).
 * Does NOT add cuenta_id (Módulo 12).
 *
 * empresa_nombre backfill: existing rows get 'PENDIENTE' (manual update by comercial).
 */

const ORIGEN_VIA = ['desde_sql', 'directa'];
const PRESUPUESTO_MONEDA = ['COP', 'USD'];
const PRESUPUESTO_FUENTE = [
  'cliente_declaro',
  'contrato_previo',
  'licitacion_publicada',
  'estimacion_comercial',
  'sin_verificar',
];

async function columnExists(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column
    `,
    { replacements: { table, column } },
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'ouvs', 'origen_via'))) {
      await queryInterface.addColumn('ouvs', 'origen_via', {
        type: Sequelize.ENUM(...ORIGEN_VIA),
        allowNull: false,
        defaultValue: 'desde_sql',
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'empresa_nombre'))) {
      await queryInterface.addColumn('ouvs', 'empresa_nombre', {
        type: Sequelize.STRING(200),
        allowNull: true,
      });
      await queryInterface.sequelize.query(
        `UPDATE ouvs SET empresa_nombre = 'PENDIENTE' WHERE empresa_nombre IS NULL`,
      );
      await queryInterface.changeColumn('ouvs', 'empresa_nombre', {
        type: Sequelize.STRING(200),
        allowNull: false,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'tiene_gap'))) {
      await queryInterface.addColumn('ouvs', 'tiene_gap', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'criterios_faltantes'))) {
      await queryInterface.addColumn('ouvs', 'criterios_faltantes', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'presupuesto_confirmado'))) {
      await queryInterface.addColumn('ouvs', 'presupuesto_confirmado', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'presupuesto_monto'))) {
      await queryInterface.addColumn('ouvs', 'presupuesto_monto', {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'presupuesto_moneda'))) {
      await queryInterface.addColumn('ouvs', 'presupuesto_moneda', {
        type: Sequelize.ENUM(...PRESUPUESTO_MONEDA),
        allowNull: true,
      });
    }

    if (
      !(await columnExists(queryInterface, 'ouvs', 'presupuesto_fecha_captura'))
    ) {
      await queryInterface.addColumn('ouvs', 'presupuesto_fecha_captura', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'presupuesto_fuente'))) {
      await queryInterface.addColumn('ouvs', 'presupuesto_fuente', {
        type: Sequelize.ENUM(...PRESUPUESTO_FUENTE),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'motivo_id'))) {
      await queryInterface.addColumn('ouvs', 'motivo_id', {
        type: Sequelize.CHAR(36),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'motivo_snapshot'))) {
      await queryInterface.addColumn('ouvs', 'motivo_snapshot', {
        type: Sequelize.STRING(200),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'motivo_detalle'))) {
      await queryInterface.addColumn('ouvs', 'motivo_detalle', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'competidor_ganador'))) {
      await queryInterface.addColumn('ouvs', 'competidor_ganador', {
        type: Sequelize.STRING(200),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'monto_final'))) {
      await queryInterface.addColumn('ouvs', 'monto_final', {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'moneda_final'))) {
      await queryInterface.addColumn('ouvs', 'moneda_final', {
        type: Sequelize.ENUM(...PRESUPUESTO_MONEDA),
        allowNull: true,
      });
    }

    if (
      !(await columnExists(queryInterface, 'ouvs', 'monto_estimado_perdido'))
    ) {
      await queryInterface.addColumn('ouvs', 'monto_estimado_perdido', {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'ouvs', 'fecha_cierre'))) {
      await queryInterface.addColumn('ouvs', 'fecha_cierre', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    await queryInterface.addIndex('ouvs', ['origen_via'], {
      name: 'idx_ouvs_origen_via',
    });
    await queryInterface.addIndex('ouvs', ['resultado'], {
      name: 'idx_ouvs_resultado',
    });
    await queryInterface.addIndex('ouvs', ['tiene_gap'], {
      name: 'idx_ouvs_tiene_gap',
    });
  },

  async down(queryInterface) {
    const dropIndexSafe = async (name) => {
      try {
        await queryInterface.removeIndex('ouvs', name);
      } catch {
        /* index may not exist */
      }
    };
    await dropIndexSafe('idx_ouvs_origen_via');
    await dropIndexSafe('idx_ouvs_resultado');
    await dropIndexSafe('idx_ouvs_tiene_gap');

    const cols = [
      'fecha_cierre',
      'monto_estimado_perdido',
      'moneda_final',
      'monto_final',
      'competidor_ganador',
      'motivo_detalle',
      'motivo_snapshot',
      'motivo_id',
      'presupuesto_fuente',
      'presupuesto_fecha_captura',
      'presupuesto_moneda',
      'presupuesto_monto',
      'presupuesto_confirmado',
      'criterios_faltantes',
      'tiene_gap',
      'empresa_nombre',
      'origen_via',
    ];
    for (const col of cols) {
      if (await columnExists(queryInterface, 'ouvs', col)) {
        await queryInterface.removeColumn('ouvs', col);
      }
    }
  },
};
