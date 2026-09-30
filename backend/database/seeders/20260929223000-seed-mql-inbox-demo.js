'use strict';

/**
 * MQL bandeja (Mercadeo): leads MQL_PENDING + mqls Activo sin SQL.
 */

const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001';
const MARKER_LEAD_ID = 'e1b2c3d4-d5e6-4789-a012-000000000001';

function inboxSlot(n) {
  return `e1b2c3d4-d5e6-4789-a012-${String(n).padStart(12, '0')}`;
}

const INBOX_DEMOS = [
  {
    accountName: 'Molinos Arman',
    taxId: '900123456-1',
    contact: 'Ana Lucía García',
    email: 'ana.garcia@molinos-demo.co',
    segmento: 'Industria',
  },
  {
    accountName: 'Grupo Verytel Demo',
    taxId: '900987654-3',
    contact: 'Carlos Méndez',
    email: 'carlos.mendez@verytel-demo.com',
    segmento: 'Gobierno central',
  },
  {
    accountName: 'Finanzas Andinas SAS',
    taxId: '901555444-2',
    contact: 'Laura Vargas',
    email: 'laura.vargas@banco-ejemplo.com.co',
    segmento: 'Industria',
  },
  {
    accountName: 'Alcaldía Demo Cali',
    taxId: '890399001-4',
    contact: 'Diego Herrera',
    email: 'diego.herrera@cali-demo.gov.co',
    segmento: 'Ciudades y gobernaciones',
  },
  {
    accountName: 'Hospital Departamental Norte',
    taxId: '890711001-9',
    contact: 'María Soto',
    email: 'maria.soto@hospital-norte.gov.co',
    segmento: 'Gobierno central',
  },
  {
    accountName: 'Universidad Demo Antioquia',
    taxId: '890980040-1',
    contact: 'Pedro Ramírez',
    email: 'pedro.ramirez@udemo.edu.co',
    segmento: 'Ciudades y gobernaciones',
  },
  {
    accountName: 'Comando Militar Demo',
    taxId: '900111222-3',
    contact: 'Juan Ortiz',
    email: 'juan.ortiz@mindef-demo.mil.co',
    segmento: 'Defensa y seguridad',
  },
  {
    accountName: 'Operador Logístico Pacífico',
    taxId: '901222333-4',
    contact: 'Sandra Ruiz',
    email: 'sandra.ruiz@logistico-demo.co',
    segmento: 'Industria',
  },
  {
    accountName: 'Gobernación Demo Cundinamarca',
    taxId: '899999114-1',
    contact: 'Felipe Castro',
    email: 'felipe.castro@gobcund-demo.gov.co',
    segmento: 'Ciudades y gobernaciones',
  },
  {
    accountName: 'Empresa de Energía Demo',
    taxId: '900333444-5',
    contact: 'Camila Torres',
    email: 'camila.torres@energia-demo.co',
    segmento: 'Industria',
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [marker] = await queryInterface.sequelize.query(
      'SELECT lead_id FROM leads WHERE lead_id = :id AND deleted_at IS NULL LIMIT 1',
      { replacements: { id: MARKER_LEAD_ID } },
    );
    if (marker.length > 0) {
      console.log('MQL inbox demo seed: already applied, skipping.');
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
      console.log('MQL inbox demo seed: no users found, skipping.');
      return;
    }
    const actorId = users[0].user_id;
    const now = new Date();

    async function ensureAccount(name, taxId, accountSlot) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT account_id FROM accounts
         WHERE deleted_at IS NULL AND name = :name LIMIT 1`,
        { replacements: { name } },
      );
      if (rows.length) return rows[0].account_id;
      const accountId = inboxSlot(accountSlot);
      await queryInterface.bulkInsert('accounts', [
        {
          account_id: accountId,
          name,
          tax_id: taxId,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
      ]);
      return accountId;
    }

    const leads = [];
    const checklists = [];
    const mqls = [];
    const people = [];
    const leadContacts = [];

    for (let i = 0; i < INBOX_DEMOS.length; i += 1) {
      const demo = INBOX_DEMOS[i];
      const idx = i + 1;
      const leadId = idx === 1 ? MARKER_LEAD_ID : inboxSlot(idx);
      const checklistId = inboxSlot(100 + idx);
      const mqlId = inboxSlot(200 + idx);
      const personId = inboxSlot(300 + idx);
      const contactId = inboxSlot(400 + idx);

      const accountId = await ensureAccount(
        demo.accountName,
        demo.taxId,
        800 + idx,
      );

      people.push({
        person_id: personId,
        name: demo.contact,
        job_title: 'Director de TI',
        email: demo.email,
        phone: '+57 300 100 00' + String(idx).padStart(2, '0'),
        account_id: accountId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });

      const withCitaAgendada = idx <= 4;
      const fechaCita = withCitaAgendada
        ? new Date(`${new Date().getFullYear()}-09-${10 + idx}T14:00:00.000Z`)
        : null;

      leads.push({
        lead_id: leadId,
        tipo_lead: 'Inbound',
        origen: 'Web',
        canal_origen: 'CAMPANA_DIGITAL',
        segmento: demo.segmento,
        region: 'Bogotá',
        pais: 'CO',
        estado: 'MQL_PENDING',
        name: `DEMO-MQL-INBOX-${String(idx).padStart(2, '0')} ${demo.accountName}`,
        responsable_id: actorId,
        created_by: actorId,
        cita_agendada: withCitaAgendada,
        fecha_cita: fechaCita,
        fecha_captura: now,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });

      checklists.push({
        checklist_id: checklistId,
        lead_id: leadId,
        criterio_sector_objetivo: true,
        criterio_necesidad_portafolio: true,
        criterio_acceso_decisor: idx % 3 !== 0,
        resultado: 'Calificado',
        completado_por: actorId,
        fecha_completado: now,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });

      mqls.push({
        mql_id: mqlId,
        lead_id: leadId,
        checklist_id: checklistId,
        calificado_por: actorId,
        fecha_calificacion: new Date(now.getTime() - idx * 86400000),
        motivo_calificacion: 'Demo bandeja MQL — checklist BOFU completo',
        estado: 'Activo',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });

      leadContacts.push({
        contact_id: contactId,
        lead_id: leadId,
        position: 1,
        person_id: personId,
        tipo_influencia: 'Economica',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });
    }

    await queryInterface.bulkInsert('people', people);
    await queryInterface.bulkInsert('leads', leads);
    await queryInterface.bulkInsert('lead_checklist', checklists);
    await queryInterface.bulkInsert('mqls', mqls);
    await queryInterface.bulkInsert('lead_contacts', leadContacts);

    console.log(`MQL inbox demo seed: ${mqls.length} MQL activos pendientes de aprobación.`);
  },

  async down(queryInterface) {
    const leadRows = await queryInterface.sequelize.query(
      `SELECT lead_id FROM leads WHERE name LIKE 'DEMO-MQL-INBOX-%'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    if (!leadRows.length) return;

    const leadIds = leadRows.map((r) => r.lead_id);
    const leadPh = leadIds.map(() => '?').join(',');

    const contactRows = await queryInterface.sequelize.query(
      `SELECT person_id FROM lead_contacts WHERE lead_id IN (${leadPh})`,
      { replacements: leadIds, type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    const personIds = [...new Set(contactRows.map((r) => r.person_id))];

    await queryInterface.sequelize.query(
      `DELETE FROM lead_contacts WHERE lead_id IN (${leadPh})`,
      { replacements: leadIds },
    );
    await queryInterface.sequelize.query(
      `DELETE FROM mqls WHERE lead_id IN (${leadPh})`,
      { replacements: leadIds },
    );
    await queryInterface.sequelize.query(
      `DELETE FROM lead_checklist WHERE lead_id IN (${leadPh})`,
      { replacements: leadIds },
    );
    await queryInterface.sequelize.query(
      `DELETE FROM leads WHERE lead_id IN (${leadPh})`,
      { replacements: leadIds },
    );

    if (personIds.length) {
      const personPh = personIds.map(() => '?').join(',');
      await queryInterface.sequelize.query(
        `DELETE FROM people WHERE person_id IN (${personPh})`,
        { replacements: personIds },
      );
    }
  },
};
