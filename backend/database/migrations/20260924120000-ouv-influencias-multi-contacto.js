'use strict';

/**
 * One row per (ouv_id, tipo, contacto_ouv_id).
 * Null-contact rows are deleted (note text is not kept).
 * Amarillo becomes SinEvaluar and each affected id is audited.
 * down restores the enum and the old unique key. It does not restore
 * Amarillo values, discarded notes, or deleted placeholder rows.
 */

const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001';
const MIGRATION_CONTEXT = 'migration:2026-09-24-influencias-multi-contacto';
const ENUM_SIN_AMARILLO =
  "ENUM('Verde','Rojo','SinEvaluar') NOT NULL DEFAULT 'SinEvaluar'";
const ENUM_CON_AMARILLO =
  "ENUM('Verde','Rojo','Amarillo','SinEvaluar') NOT NULL DEFAULT 'SinEvaluar'";

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
  async up(queryInterface) {
    if (!(await tableExists(queryInterface, 'ouv_influencias'))) {
      return;
    }

    const sequelize = queryInterface.sequelize;

    const [nullRows] = await sequelize.query(
      `
        SELECT influencia_id, ouv_id, estado,
               CASE
                 WHEN notas IS NOT NULL AND CHAR_LENGTH(TRIM(notas)) > 0 THEN 1
                 ELSE 0
               END AS tiene_nota
        FROM ouv_influencias
        WHERE contacto_ouv_id IS NULL
      `,
    );

    const verdes = nullRows.filter((row) => row.estado === 'Verde');
    const notasDescartadas = nullRows.filter(
      (row) => Number(row.tiene_nota) === 1,
    ).length;
    const ouvIdsVerdes = [...new Set(verdes.map((row) => row.ouv_id))];

    console.log(
      `[influencias-multi-contacto] filas sin contacto: ${nullRows.length}`,
    );
    console.log(
      `[influencias-multi-contacto] filas sin contacto en Verde: ${verdes.length}`,
    );
    console.log(
      `[influencias-multi-contacto] ouv_id en Verde sin contacto: ${ouvIdsVerdes.join(',')}`,
    );
    console.log(
      `[influencias-multi-contacto] notas descartadas: ${notasDescartadas}`,
    );

    if (nullRows.length > 0) {
      await sequelize.query(
        `DELETE FROM ouv_influencias WHERE contacto_ouv_id IS NULL`,
      );
    }

    const [amarillos] = await sequelize.query(
      `
        SELECT influencia_id
        FROM ouv_influencias
        WHERE estado = 'Amarillo'
      `,
    );

    for (const row of amarillos) {
      await sequelize.query(
        `
          INSERT INTO audit_log (
            audit_id, tabla, registro_id, accion, campo_modificado,
            valor_anterior, valor_nuevo, usuario_id, ip_address,
            user_agent, timestamp, contexto
          ) VALUES (
            UUID(), 'ouv_influencias', :registroId, 'STATE_CHANGE', 'estado',
            'Amarillo', 'SinEvaluar', :usuarioId, '0.0.0.0',
            NULL, NOW(), CAST(:contexto AS JSON)
          )
        `,
        {
          replacements: {
            registroId: row.influencia_id,
            usuarioId: SYSTEM_USER_ID,
            contexto: JSON.stringify(MIGRATION_CONTEXT),
          },
        },
      );
    }

    if (amarillos.length > 0) {
      await sequelize.query(
        `
          UPDATE ouv_influencias
          SET estado = 'SinEvaluar'
          WHERE estado = 'Amarillo'
        `,
      );
    }

    await sequelize.query(
      `ALTER TABLE ouv_influencias MODIFY COLUMN estado ${ENUM_SIN_AMARILLO}`,
    );

    const [indexes] = await sequelize.query(
      `SHOW INDEX FROM ouv_influencias WHERE Key_name = 'uq_ouv_influencias_ouv_tipo_contacto'`,
    );
    if (indexes.length === 0) {
      await queryInterface.addIndex(
        'ouv_influencias',
        ['ouv_id', 'tipo', 'contacto_ouv_id'],
        {
          name: 'uq_ouv_influencias_ouv_tipo_contacto',
          unique: true,
        },
      );
    }

    const [oldUnique] = await sequelize.query(
      `SHOW INDEX FROM ouv_influencias WHERE Key_name = 'uq_ouv_influencias_ouv_tipo'`,
    );
    if (oldUnique.length > 0) {
      await queryInterface.removeIndex(
        'ouv_influencias',
        'uq_ouv_influencias_ouv_tipo',
      );
    }

    if (!(await columnExists(queryInterface, 'ouv_influencias', 'deleted_at'))) {
      await queryInterface.addColumn('ouv_influencias', 'deleted_at', {
        type: 'DATETIME',
        allowNull: true,
      });
    }

    const [contactoFks] = await sequelize.query(
      `
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'ouv_influencias'
          AND COLUMN_NAME = 'contacto_ouv_id'
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `,
    );
    for (const fk of contactoFks) {
      await sequelize.query(
        `ALTER TABLE ouv_influencias DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``,
      );
    }

    await sequelize.query(
      `
        ALTER TABLE ouv_influencias
        MODIFY COLUMN contacto_ouv_id CHAR(36) NOT NULL
      `,
    );

    for (const fk of contactoFks) {
      await sequelize.query(
        `
          ALTER TABLE ouv_influencias
          ADD CONSTRAINT \`${fk.CONSTRAINT_NAME}\`
          FOREIGN KEY (contacto_ouv_id) REFERENCES ouv_contactos (contacto_ouv_id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT
        `,
      );
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, 'ouv_influencias'))) {
      return;
    }

    const sequelize = queryInterface.sequelize;

    await queryInterface.removeIndex(
      'ouv_influencias',
      'uq_ouv_influencias_ouv_tipo_contacto',
    );

    await sequelize.query(
      `
        ALTER TABLE ouv_influencias
        MODIFY COLUMN estado ${ENUM_CON_AMARILLO}
      `,
    );

    const [contactoFks] = await sequelize.query(
      `
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'ouv_influencias'
          AND COLUMN_NAME = 'contacto_ouv_id'
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `,
    );
    for (const fk of contactoFks) {
      await sequelize.query(
        `ALTER TABLE ouv_influencias DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``,
      );
    }
    await sequelize.query(
      `
        ALTER TABLE ouv_influencias
        MODIFY COLUMN contacto_ouv_id CHAR(36) NULL
      `,
    );
    for (const fk of contactoFks) {
      await sequelize.query(
        `
          ALTER TABLE ouv_influencias
          ADD CONSTRAINT \`${fk.CONSTRAINT_NAME}\`
          FOREIGN KEY (contacto_ouv_id) REFERENCES ouv_contactos (contacto_ouv_id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
        `,
      );
    }

    if (await columnExists(queryInterface, 'ouv_influencias', 'deleted_at')) {
      await sequelize.query(
        `DELETE FROM ouv_influencias WHERE deleted_at IS NOT NULL`,
      );
      await queryInterface.removeColumn('ouv_influencias', 'deleted_at');
    }

    await sequelize.query(
      `
        DELETE i
        FROM ouv_influencias i
        INNER JOIN ouv_influencias keeper
          ON keeper.ouv_id = i.ouv_id
         AND keeper.tipo = i.tipo
         AND keeper.influencia_id < i.influencia_id
      `,
    );

    await queryInterface.addIndex('ouv_influencias', ['ouv_id', 'tipo'], {
      name: 'uq_ouv_influencias_ouv_tipo',
      unique: true,
    });
  },
};
