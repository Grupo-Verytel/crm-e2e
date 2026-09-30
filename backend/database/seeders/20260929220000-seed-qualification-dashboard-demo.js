'use strict';

/**
 * Demo rows for Calificación dashboard (bandeja, sql_citas, OUV pipeline).
 * Idempotent: skips when marker lead already exists.
 */

const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001';
const MARKER_LEAD_ID = 'f1a2b3c4-d5e6-4789-a012-000000000001';

function slot(n) {
  return `f1a2b3c4-d5e6-4789-a012-${String(n).padStart(12, '0')}`;
}

const ROUTING_COUNT = 8;
const CITAS_SQL_COUNT = 29;
const YEAR = new Date().getFullYear();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [marker] = await queryInterface.sequelize.query(
      'SELECT lead_id FROM leads WHERE lead_id = :id AND deleted_at IS NULL LIMIT 1',
      { replacements: { id: MARKER_LEAD_ID } },
    );
    if (marker.length > 0) {
      console.log('Qualification dashboard demo seed: already applied, skipping.');
      return;
    }

    const [users] = await queryInterface.sequelize.query(
      `SELECT user_id FROM users
       WHERE deleted_at IS NULL AND (is_active = 1 OR user_id = :systemId)
       ORDER BY is_active DESC
       LIMIT 1`,
      { replacements: { systemId: SYSTEM_USER_ID } },
    );
    if (!users.length) {
      console.log(
        'Qualification dashboard demo seed: no users found, skipping.',
      );
      return;
    }
    const actorId = users[0].user_id;
    const now = new Date();

    const leadBase = {
      tipo_lead: 'Inbound',
      origen: 'Web',
      canal_origen: 'CAMPANA_DIGITAL',
      segmento: 'Gobierno central',
      region: 'Bogotá',
      pais: 'CO',
      estado: 'SQL',
      responsable_id: actorId,
      created_by: actorId,
      cita_agendada: false,
      fecha_captura: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    const leads = [];
    const checklists = [];
    const mqls = [];
    const sqls = [];
    const citas = [];
    const ouvs = [];

    for (let i = 1; i <= ROUTING_COUNT; i += 1) {
      const leadId = i === 1 ? MARKER_LEAD_ID : slot(i);
      const withCita = i > 5;
      const fechaCita = withCita
        ? new Date(`${YEAR}-09-${10 + (i % 5)}T15:00:00.000Z`)
        : null;
      leads.push({
        ...leadBase,
        lead_id: leadId,
        name: `DEMO-CALIF-DASH-R${String(i).padStart(2, '0')}`,
        cita_agendada: withCita,
        fecha_cita: fechaCita,
      });

      const checklistId = slot(100 + i);
      checklists.push({
        checklist_id: checklistId,
        lead_id: leadId,
        criterio_sector_objetivo: true,
        criterio_necesidad_portafolio: true,
        criterio_acceso_decisor: true,
        resultado: 'Calificado',
        completado_por: actorId,
        fecha_completado: now,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });

      const mqlId = slot(200 + i);
      mqls.push({
        mql_id: mqlId,
        lead_id: leadId,
        checklist_id: checklistId,
        calificado_por: actorId,
        fecha_calificacion: now,
        motivo_calificacion: 'Demo dashboard calificación',
        estado: 'ConvertidoSQL',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });

      sqls.push({
        sql_id: slot(300 + i),
        mql_id: mqlId,
        estado: 'PendienteAsignacion',
        en_backlog: true,
        comercial_asignado_id: null,
        fecha_asignacion: null,
        origen_creacion: 'enrutamiento_normal',
        fecha_creacion: now,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });
    }

    const citaEstados = [
      ...Array(12).fill('Agendada'),
      ...Array(6).fill('Reagendada'),
      ...Array(7).fill('Realizada'),
      ...Array(3).fill('Cancelada'),
      ...Array(1).fill('NoAsistio'),
    ];

    for (let j = 0; j < CITAS_SQL_COUNT; j += 1) {
      const idx = ROUTING_COUNT + j + 1;
      const leadId = slot(idx);
      const estadoCita = citaEstados[j] ?? 'Agendada';
      const day = 5 + (j % 20);
      const fechaCitaDate = `${YEAR}-${String(9).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      leads.push({
        ...leadBase,
        lead_id: leadId,
        name: `DEMO-CALIF-DASH-C${String(j + 1).padStart(2, '0')}`,
        cita_agendada: true,
        fecha_cita: new Date(`${fechaCitaDate}T10:00:00.000Z`),
      });

      const checklistId = slot(100 + idx);
      checklists.push({
        checklist_id: checklistId,
        lead_id: leadId,
        criterio_sector_objetivo: true,
        criterio_necesidad_portafolio: true,
        criterio_acceso_decisor: true,
        resultado: 'Calificado',
        completado_por: actorId,
        fecha_completado: now,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });

      const mqlId = slot(200 + idx);
      mqls.push({
        mql_id: mqlId,
        lead_id: leadId,
        checklist_id: checklistId,
        calificado_por: actorId,
        fecha_calificacion: now,
        estado: 'ConvertidoSQL',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });

      const sqlId = slot(300 + idx);
      sqls.push({
        sql_id: sqlId,
        mql_id: mqlId,
        estado: 'Asignado',
        en_backlog: false,
        comercial_asignado_id: actorId,
        fecha_asignacion: now,
        origen_creacion: 'enrutamiento_normal',
        fecha_creacion: now,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });

      citas.push({
        cita_id: slot(500 + j + 1),
        sql_id: sqlId,
        lugar: 'Oficinas Verytel — Sala demo',
        fecha: fechaCitaDate,
        hora: '10:00:00',
        contacto_nombre: `Contacto demo ${j + 1}`,
        contacto_cargo: 'Director TI',
        descripcion: 'Cita demo dashboard calificación',
        agendada_por: actorId,
        estado: estadoCita,
        created_at: now,
        updated_at: now,
      });
    }

    for (let k = 1; k <= 9; k += 1) {
      const ouvId = slot(600 + k);
      ouvs.push({
        ouv_id: ouvId,
        consecutivo: `DEMO-QD-${String(k).padStart(3, '0')}`,
        sql_id_origen: null,
        origen_via: 'directa',
        origen: 'Web',
        canal_origen: 'CAMPANA_DIGITAL',
        comercial_id: actorId,
        account_id: null,
        titulo: `OUV demo listas oferta ${k}`,
        empresa_nombre: `Cliente demo calificación ${k}`,
        descripcion: 'Seed dashboard calificación',
        segmento: 'Gobierno central',
        vertical: 'Seguridad Ciudadana',
        zona_actual: 'MAYOR_PROBABILIDAD',
        resultado: 'EnCurso',
        tiene_gap: false,
        presupuesto_confirmado: false,
        created_at: now,
        updated_at: now,
      });
    }

    for (let g = 1; g <= 5; g += 1) {
      const ouvId = slot(700 + g);
      const closedAt = new Date(`${YEAR}-09-${12 + g}T18:00:00.000Z`);
      ouvs.push({
        ouv_id: ouvId,
        consecutivo: `DEMO-QG-${String(g).padStart(3, '0')}`,
        sql_id_origen: null,
        origen_via: 'directa',
        origen: 'Web',
        canal_origen: 'CAMPANA_DIGITAL',
        comercial_id: actorId,
        account_id: null,
        titulo: `OUV demo ganada ${g}`,
        empresa_nombre: `Cliente ganado demo ${g}`,
        descripcion: 'Seed dashboard calificación',
        segmento: 'Defensa y seguridad',
        vertical: 'Defensa',
        zona_actual: 'MAYOR_PROBABILIDAD',
        resultado: 'Ganada',
        tiene_gap: false,
        presupuesto_confirmado: true,
        created_at: closedAt,
        updated_at: closedAt,
      });
    }

    await queryInterface.bulkInsert('leads', leads);
    await queryInterface.bulkInsert('lead_checklist', checklists);
    await queryInterface.bulkInsert('mqls', mqls);
    await queryInterface.bulkInsert('sqls', sqls);
    if (citas.length) {
      await queryInterface.bulkInsert('sql_citas', citas);
    }
    await queryInterface.bulkInsert('ouvs', ouvs);

    console.log(
      `Qualification dashboard demo seed: ${ROUTING_COUNT} routing SQL, ${citas.length} citas, ${ouvs.length} OUVs.`,
    );
  },

  async down(queryInterface) {
    const leadIds = await queryInterface.sequelize.query(
      `SELECT lead_id FROM leads WHERE name LIKE 'DEMO-CALIF-DASH-%'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    if (!leadIds.length) return;

    const ids = leadIds.map((r) => r.lead_id);
    const placeholders = ids.map(() => '?').join(',');

    const mqlRows = await queryInterface.sequelize.query(
      `SELECT mql_id FROM mqls WHERE lead_id IN (${placeholders})`,
      { replacements: ids, type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    const mqlIds = mqlRows.map((r) => r.mql_id);

    if (mqlIds.length) {
      const mqlPh = mqlIds.map(() => '?').join(',');
      const sqlRows = await queryInterface.sequelize.query(
        `SELECT sql_id FROM sqls WHERE mql_id IN (${mqlPh})`,
        {
          replacements: mqlIds,
          type: queryInterface.sequelize.QueryTypes.SELECT,
        },
      );
      const sqlIds = sqlRows.map((r) => r.sql_id);
      if (sqlIds.length) {
        const sqlPh = sqlIds.map(() => '?').join(',');
        await queryInterface.sequelize.query(
          `DELETE FROM sql_citas WHERE sql_id IN (${sqlPh})`,
          { replacements: sqlIds },
        );
        await queryInterface.sequelize.query(
          `DELETE FROM sqls WHERE sql_id IN (${sqlPh})`,
          { replacements: sqlIds },
        );
      }
      await queryInterface.sequelize.query(
        `DELETE FROM mqls WHERE mql_id IN (${mqlPh})`,
        { replacements: mqlIds },
      );
    }

    await queryInterface.sequelize.query(
      `DELETE FROM lead_checklist WHERE lead_id IN (${placeholders})`,
      { replacements: ids },
    );
    await queryInterface.sequelize.query(
      `DELETE FROM leads WHERE lead_id IN (${placeholders})`,
      { replacements: ids },
    );
    await queryInterface.sequelize.query(
      `DELETE FROM ouvs WHERE consecutivo LIKE 'DEMO-QD-%' OR consecutivo LIKE 'DEMO-QG-%'`,
    );
  },
};
