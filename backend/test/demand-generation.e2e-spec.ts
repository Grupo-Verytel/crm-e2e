import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import request from 'supertest';
import { App } from 'supertest/types';
import { Op } from 'sequelize';
import { createE2eApp, uniqueTestEmail } from './helpers/e2e-app.helper';
import { AuditLog } from '../src/modules/audit/models/audit-log.model';
import { AuditAction } from '../src/modules/audit/models/audit-action.enum';
import { User } from '../src/modules/auth/models/user.model';
import { LeadEstado } from '../src/modules/demand-generation/models/enums/lead.enums';
import { Campaign } from '../src/modules/demand-generation/models/campaign.model';
import { Interaction } from '../src/modules/demand-generation/models/interaction.model';
import { Lead } from '../src/modules/demand-generation/models/lead.model';
import { LeadChecklist } from '../src/modules/demand-generation/models/lead-checklist.model';
import { Mql } from '../src/modules/demand-generation/models/mql.model';
import { Sql } from '../src/modules/demand-generation/models/sql.model';
import { DemandGenerationService } from '../src/modules/demand-generation/services/demand-generation.service';
import { CSV_LEAD_HEADERS } from '../src/modules/demand-generation/constants/demand-generation.constants';

describe('Demand generation module (EARS DG-01..DG-18)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let marketingToken: string;
  let marketingUserId: string;
  let directorToken: string;
  let commercialToken: string;
  let gestorMercadeoRoleId: string;
  let directorMercadeoRoleId: string;
  let kamRoleId: string;

  const createdUserIds: string[] = [];
  const createdLeadIds: string[] = [];
  const createdCampaignIds: string[] = [];

  const adminEmail = process.env.ADMIN_INITIAL_EMAIL;
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;

  function futureDate(daysFromNow: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + daysFromNow);
    return date.toISOString().slice(0, 10);
  }

  function buildLeadPayload(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      tipo_lead: 'Inbound',
      origen: 'Web',
      segmento: 'Gobierno',
      region: 'Bogota',
      pais: 'CO',
      empresa_nombre: 'EARS Test Co',
      contacto_nombre: 'Jane Doe',
      email: uniqueTestEmail('ears-lead'),
      responsable_id: marketingUserId,
      ...overrides,
    };
  }

  function buildCsvRow(values: Record<string, string>): string {
    return CSV_LEAD_HEADERS.map((header) => values[header] ?? '').join(',');
  }

  async function createUserWithRole(
    prefix: string,
    roleId: string,
  ): Promise<{ userId: string; token: string }> {
    const email = uniqueTestEmail(prefix);
    const password = 'TestPass123!';

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, password, full_name: `EARS ${prefix}`, role_id: roleId })
      .expect(201);

    createdUserIds.push(createResponse.body.user_id);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    return {
      userId: createResponse.body.user_id,
      token: loginResponse.body.access_token,
    };
  }

  async function createLeadViaApi(
    overrides: Record<string, unknown> = {},
    token = marketingToken,
  ) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${token}`)
      .send(buildLeadPayload(overrides))
      .expect(201);

    createdLeadIds.push(response.body.lead_id);
    return response.body;
  }

  async function createCampaignViaApi(overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({
        nombre: `EARS Campaign ${Date.now()}-${Math.random()}`,
        tipo: 'Email',
        canal: 'Newsletter',
        objetivo: 'LeadGen',
        segmento_objetivo: 'Todos',
        responsable_id: marketingUserId,
        fecha_inicio: futureDate(1),
        fecha_fin: futureDate(30),
        gasto_real: 1000,
        ...overrides,
      })
      .expect(201);

    createdCampaignIds.push(response.body.campana_id);
    return response.body;
  }

  async function registerInteraction(leadId: string) {
    return request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/interactions`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({ tipo: 'Llamada', canal: 'Telefono', descripcion: 'First touch' })
      .expect(201);
  }

  async function moveLeadToMofu(leadId: string) {
    await registerInteraction(leadId);
    return request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/transition-to-mofu`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({})
      .expect(200);
  }

  async function completeChecklist(leadId: string) {
    return request(app.getHttpServer())
      .put(`/api/v1/leads/${leadId}/checklist`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({
        criterio_sector_objetivo: true,
        criterio_necesidad_portafolio: true,
        criterio_acceso_decisor: true,
        criterio_presupuesto_indicios: true,
      })
      .expect(200);
  }

  beforeAll(async () => {
    if (!adminEmail || !adminPassword) {
      throw new Error(
        'Set ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD in backend/.env for e2e tests',
      );
    }

    app = await createE2eApp();

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);

    adminToken = loginResponse.body.access_token;

    const rolesResponse = await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const findRole = (name: string) =>
      rolesResponse.body.find((role: { name: string }) => role.name === name)
        .role_id;

    gestorMercadeoRoleId = findRole('GestorMercadeo');
    directorMercadeoRoleId = findRole('DirectorMercadeo');
    kamRoleId = findRole('EjecutivoComercial');

    const marketing = await createUserWithRole('gestor', gestorMercadeoRoleId);
    marketingUserId = marketing.userId;
    marketingToken = marketing.token;

    const director = await createUserWithRole(
      'director',
      directorMercadeoRoleId,
    );
    directorToken = director.token;

    const commercial = await createUserWithRole('kam', kamRoleId);
    commercialToken = commercial.token;
  });

  afterAll(async () => {
    const leadModel = app.get<typeof Lead>(getModelToken(Lead));
    const campaignModel = app.get<typeof Campaign>(getModelToken(Campaign));
    const userModel = app.get<typeof User>(getModelToken(User));
    const interactionModel = app.get<typeof Interaction>(
      getModelToken(Interaction),
    );
    const checklistModel = app.get<typeof LeadChecklist>(
      getModelToken(LeadChecklist),
    );
    const mqlModel = app.get<typeof Mql>(getModelToken(Mql));
    const sqlModel = app.get<typeof Sql>(getModelToken(Sql));

    // Collect all leads owned by the test users so children can be removed first.
    const ownedLeads = await leadModel.findAll({
      where: {
        [Op.or]: [
          { responsableId: { [Op.in]: createdUserIds } },
          { createdBy: { [Op.in]: createdUserIds } },
        ],
      },
      paranoid: false,
    });
    const leadIds = Array.from(
      new Set([...createdLeadIds, ...ownedLeads.map((lead) => lead.leadId)]),
    );

    const mqls = await mqlModel.findAll({
      where: { leadId: { [Op.in]: leadIds } },
      paranoid: false,
    });
    const mqlIds = mqls.map((mql) => mql.mqlId);

    await sqlModel.destroy({
      where: { mqlId: { [Op.in]: mqlIds } },
      force: true,
    });
    await mqlModel.destroy({
      where: { leadId: { [Op.in]: leadIds } },
      force: true,
    });
    await checklistModel.destroy({
      where: { leadId: { [Op.in]: leadIds } },
      force: true,
    });
    await interactionModel.destroy({
      where: { leadId: { [Op.in]: leadIds } },
      force: true,
    });
    await leadModel.destroy({
      where: { leadId: { [Op.in]: leadIds } },
      force: true,
    });

    if (createdCampaignIds.length > 0) {
      await campaignModel.destroy({
        where: { campanaId: { [Op.in]: createdCampaignIds } },
        force: true,
      });
    }

    if (createdUserIds.length > 0) {
      await userModel.destroy({
        where: { userId: { [Op.in]: createdUserIds } },
      });
    }

    await app.close();
  });

  it('DG-01/DG-03: creates a lead and auto-transitions it to TOFU with created_by set', async () => {
    const missing = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({
        tipo_lead: 'Inbound',
        origen: 'Web',
        segmento: 'Gobierno',
        region: 'Bogota',
        pais: 'CO',
        empresa_nombre: 'Missing Email Co',
        contacto_nombre: 'Jane',
        responsable_id: marketingUserId,
      })
      .expect(400);
    expect(missing.body.message).toBeDefined();

    const lead = await createLeadViaApi();
    expect(lead.estado).toBe(LeadEstado.TOFU);
    expect(lead.created_by).toBe(marketingUserId);
  });

  it('DG-02: requires industria when segmento is B2B', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${marketingToken}`)
      .send(buildLeadPayload({ segmento: 'B2B' }))
      .expect(400);
    expect(JSON.stringify(response.body.message)).toMatch(/industria/i);
  });

  it('DG-04: registering an interaction updates fecha_ultima_interaccion', async () => {
    const lead = await createLeadViaApi();
    expect(lead.fecha_ultima_interaccion).toBeNull();

    await registerInteraction(lead.lead_id);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/leads/${lead.lead_id}`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .expect(200);
    expect(detail.body.fecha_ultima_interaccion).not.toBeNull();
  });

  it('DG-12: rejects TOFU→MOFU without an interaction and states the missing criterion', async () => {
    const lead = await createLeadViaApi();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/leads/${lead.lead_id}/transition-to-mofu`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({})
      .expect(400);
    expect(JSON.stringify(response.body.message)).toMatch(/interacción/i);
  });

  it('DG-05/DG-13: completing the 4 criteria transitions to MQL_PENDING and creates an Activo MQL', async () => {
    const lead = await createLeadViaApi();
    await moveLeadToMofu(lead.lead_id);

    // DG-13 unwanted: incomplete checklist blocks the transition.
    await request(app.getHttpServer())
      .put(`/api/v1/leads/${lead.lead_id}/checklist`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({ criterio_sector_objetivo: true })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/leads/${lead.lead_id}/transition-to-mql`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({})
      .expect(400);

    await completeChecklist(lead.lead_id);
    const transitioned = await request(app.getHttpServer())
      .post(`/api/v1/leads/${lead.lead_id}/transition-to-mql`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({})
      .expect(200);
    expect(transitioned.body.estado).toBe(LeadEstado.MqlPending);

    const mqls = await request(app.getHttpServer())
      .get('/api/v1/mqls?estado=Activo')
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);
    expect(
      mqls.body.items.some(
        (mql: { lead_id: string }) => mql.lead_id === lead.lead_id,
      ),
    ).toBe(true);
  });

  it('DG-10: a lead in MQL_PENDING is read-only for the Gestor', async () => {
    const lead = await createLeadViaApi();
    await moveLeadToMofu(lead.lead_id);
    await completeChecklist(lead.lead_id);
    await request(app.getHttpServer())
      .post(`/api/v1/leads/${lead.lead_id}/transition-to-mql`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/leads/${lead.lead_id}`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({ region: 'Nueva' })
      .expect(400);
  });

  it('DG-06: Director approves the MQL, creating an SQL in backlog and moving the lead to SQL', async () => {
    const lead = await createLeadViaApi();
    await moveLeadToMofu(lead.lead_id);
    await completeChecklist(lead.lead_id);
    const mqlLead = await request(app.getHttpServer())
      .post(`/api/v1/leads/${lead.lead_id}/transition-to-mql`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({})
      .expect(200);
    expect(mqlLead.body.estado).toBe(LeadEstado.MqlPending);

    const mqls = await request(app.getHttpServer())
      .get('/api/v1/mqls?estado=Activo')
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);
    const mql = mqls.body.items.find(
      (item: { lead_id: string }) => item.lead_id === lead.lead_id,
    );

    const approved = await request(app.getHttpServer())
      .post(`/api/v1/mqls/${mql.mql_id}/approve`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ comentario: 'Great fit' })
      .expect(201);
    expect(approved.body.sql.en_backlog).toBe(true);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/leads/${lead.lead_id}`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .expect(200);
    expect(detail.body.estado).toBe(LeadEstado.SQL);
  });

  it('DG-07: rejecting an MQL requires motivo and recycles the lead', async () => {
    const lead = await createLeadViaApi();
    await moveLeadToMofu(lead.lead_id);
    await completeChecklist(lead.lead_id);
    await request(app.getHttpServer())
      .post(`/api/v1/leads/${lead.lead_id}/transition-to-mql`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({})
      .expect(200);

    const mqls = await request(app.getHttpServer())
      .get('/api/v1/mqls?estado=Activo')
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);
    const mql = mqls.body.items.find(
      (item: { lead_id: string }) => item.lead_id === lead.lead_id,
    );

    await request(app.getHttpServer())
      .post(`/api/v1/mqls/${mql.mql_id}/reject`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/mqls/${mql.mql_id}/reject`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ motivo: 'Timing not right' })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/leads/${lead.lead_id}`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .expect(200);
    expect(detail.body.estado).toBe(LeadEstado.Reciclaje);
  });

  it('DG-14: discarding a lead requires motivo', async () => {
    const lead = await createLeadViaApi();

    await request(app.getHttpServer())
      .post(`/api/v1/leads/${lead.lead_id}/discard`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({})
      .expect(400);

    const discarded = await request(app.getHttpServer())
      .post(`/api/v1/leads/${lead.lead_id}/discard`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({ motivo: 'No budget' })
      .expect(200);
    expect(discarded.body.estado).toBe(LeadEstado.Descartado);
    expect(discarded.body.motivo_descarte).toBe('No budget');
  });

  it('DG-08: bulk import runs async (202 + job) and skips email+nit duplicates, normalizing phone', async () => {
    const email = uniqueTestEmail('csv-import');
    const csvHeader = CSV_LEAD_HEADERS.join(',');
    const rowNew = buildCsvRow({
      tipo_lead: 'Outbound',
      origen: 'Email',
      segmento: 'Gobierno',
      region: 'Bogota',
      pais: 'CO',
      empresa_nombre: 'CSV Co',
      nit: '900123456',
      contacto_nombre: 'CSV User',
      email,
      telefono: '3001234567',
      responsable_id: marketingUserId,
    });

    const dupEmail = uniqueTestEmail('csv-dup');
    const dupNit = '900999888';
    await createLeadViaApi({ email: dupEmail, nit: dupNit });
    const rowDup = buildCsvRow({
      tipo_lead: 'Outbound',
      origen: 'Email',
      segmento: 'Gobierno',
      region: 'Bogota',
      pais: 'CO',
      empresa_nombre: 'Dup Co',
      nit: dupNit,
      contacto_nombre: 'Dup User',
      email: dupEmail,
      responsable_id: marketingUserId,
    });

    const csvContent = `${csvHeader}\n${rowNew}\n${rowDup}`;

    const accepted = await request(app.getHttpServer())
      .post('/api/v1/leads/bulk-import')
      .set('Authorization', `Bearer ${marketingToken}`)
      .attach('file', Buffer.from(csvContent, 'utf-8'), 'leads.csv')
      .expect(202);
    expect(accepted.body.job_id).toBeDefined();

    let status = accepted.body;
    for (
      let attempt = 0;
      attempt < 20 && status.status !== 'completed';
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const poll = await request(app.getHttpServer())
        .get(`/api/v1/leads/bulk-import/${accepted.body.job_id}`)
        .set('Authorization', `Bearer ${marketingToken}`)
        .expect(200);
      status = poll.body;
    }

    expect(status.status).toBe('completed');
    expect(status.created).toBe(1);
    expect(status.skipped).toHaveLength(1);
    expect(status.skipped[0].reason).toBe('Duplicate email+nit');
    createdLeadIds.push(...status.created_lead_ids);

    const importedLead = await request(app.getHttpServer())
      .get(`/api/v1/leads/${status.created_lead_ids[0]}`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .expect(200);
    expect(importedLead.body.estado).toBe(LeadEstado.TOFU);
    expect(importedLead.body.telefono).toBe('+573001234567');
  });

  it('DG-11: a lead cannot be linked to a Finalizada campaign', async () => {
    const campaign = await createCampaignViaApi();
    await request(app.getHttpServer())
      .put(`/api/v1/campaigns/${campaign.campana_id}/status`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({ estado: 'Finalizada' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${marketingToken}`)
      .send(buildLeadPayload({ campana_id: campaign.campana_id }))
      .expect(409);
  });

  it('DG-15: rejects a campaign whose fecha_fin is not after fecha_inicio', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({
        nombre: `EARS Bad Dates ${Date.now()}`,
        tipo: 'Email',
        canal: 'Newsletter',
        objetivo: 'LeadGen',
        segmento_objetivo: 'Todos',
        responsable_id: marketingUserId,
        fecha_inicio: futureDate(10),
        fecha_fin: futureDate(10),
      })
      .expect(400);
  });

  it('DG-02(cpl): leads_generados and cpl are derived on the campaign', async () => {
    const campaign = await createCampaignViaApi({ gasto_real: 500 });
    await createLeadViaApi({ campana_id: campaign.campana_id });

    const list = await request(app.getHttpServer())
      .get('/api/v1/campaigns')
      .set('Authorization', `Bearer ${marketingToken}`)
      .expect(200);
    const updated = list.body.items.find(
      (item: { campana_id: string }) => item.campana_id === campaign.campana_id,
    );
    expect(updated.leads_generados).toBe(1);
    expect(updated.cpl).toBe('500.00');
  });

  it('DG-16: persists icp_score through the public service without calculating it', async () => {
    const lead = await createLeadViaApi();
    const service = app.get(DemandGenerationService);
    const updated = await service.persistIcpScore(lead.lead_id, 82);
    expect(updated.icp_score).toBe(82);
  });

  it('DG-17: returns 403 when the actor lacks CASL permission and read-only for Soporte/KAM', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${commercialToken}`)
      .send(buildLeadPayload())
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${commercialToken}`)
      .expect(200);
  });

  it('DG-18: lead create/update auto-audit without manual audit code', async () => {
    const auditLogModel = app.get<typeof AuditLog>(getModelToken(AuditLog));
    const lead = await createLeadViaApi();

    const insertEntry = await auditLogModel.findOne({
      where: {
        tabla: 'leads',
        registro_id: lead.lead_id,
        accion: AuditAction.INSERT,
      },
    });
    expect(insertEntry).not.toBeNull();

    await request(app.getHttpServer())
      .put(`/api/v1/leads/${lead.lead_id}`)
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({ region: 'Cundinamarca' })
      .expect(200);

    const updateEntry = await auditLogModel.findOne({
      where: {
        tabla: 'leads',
        registro_id: lead.lead_id,
        accion: AuditAction.UPDATE,
        campo_modificado: 'region',
      },
    });
    expect(updateEntry).not.toBeNull();
  });
});
