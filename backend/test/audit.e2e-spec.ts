import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import request from 'supertest';
import { App } from 'supertest/types';
import { Op } from 'sequelize';
import { createE2eApp, uniqueTestEmail } from './helpers/e2e-app.helper';
import { User } from '../src/modules/auth/models/user.model';
import { Role } from '../src/modules/auth/models/role.model';
import { AuditLog } from '../src/modules/audit/models/audit-log.model';
import { AuditAction } from '../src/modules/audit/models/audit-action.enum';
import { AuditService } from '../src/modules/audit/services/audit.service';
import { SYSTEM_USER_ID } from '../src/modules/audit/constants/system-user.constants';

describe('Audit module (EARS)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let kamRoleId: string;
  const createdUserIds: string[] = [];

  const adminEmail = process.env.ADMIN_INITIAL_EMAIL;
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;

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

    kamRoleId = rolesResponse.body.find(
      (role: { name: string }) => role.name === 'EjecutivoComercial',
    ).role_id;
  });

  afterAll(async () => {
    const userModel = app.get<typeof User>(getModelToken(User));
    if (createdUserIds.length > 0) {
      await userModel.destroy({
        where: { userId: { [Op.in]: createdUserIds } },
      });
    }
    await app.close();
  });

  async function createTestUser() {
    const email = uniqueTestEmail('ears-audit');
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email,
        password: 'AuditPass123!',
        full_name: 'Audit EARS User',
        role_id: kamRoleId,
      })
      .expect(201);

    createdUserIds.push(response.body.user_id);
    return response.body;
  }

  it('EARS-AUDIT-01: auto-audits create/update/delete without manual audit code', async () => {
    const auditLogModel = app.get<typeof AuditLog>(getModelToken(AuditLog));
    const user = await createTestUser();

    const insertEntry = await auditLogModel.findOne({
      where: {
        tabla: 'users',
        registroId: user.user_id,
        accion: AuditAction.INSERT,
      },
    });
    expect(insertEntry).not.toBeNull();

    await request(app.getHttpServer())
      .put(`/api/v1/users/${user.user_id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Audit Hook Update' })
      .expect(200);

    const updateEntry = await auditLogModel.findOne({
      where: {
        tabla: 'users',
        registroId: user.user_id,
        accion: AuditAction.UPDATE,
      },
      order: [['timestamp', 'DESC']],
    });
    expect(updateEntry).not.toBeNull();

    const userModel = app.get<typeof User>(getModelToken(User));
    const userInstance = await userModel.findByPk(user.user_id);
    await userInstance!.destroy();

    const deleteEntry = await auditLogModel.findOne({
      where: {
        tabla: 'users',
        registroId: user.user_id,
        accion: AuditAction.DELETE,
      },
    });
    expect(deleteEntry).not.toBeNull();
  });

  it('EARS-AUDIT-02: INSERT stores valor_nuevo and null valor_anterior', async () => {
    const auditLogModel = app.get<typeof AuditLog>(getModelToken(AuditLog));
    const user = await createTestUser();

    const entry = await auditLogModel.findOne({
      where: { accion: AuditAction.INSERT, registroId: user.user_id },
    });

    expect(entry?.valorAnterior).toBeNull();
    expect(entry?.valorNuevo).toBeTruthy();
    expect(JSON.parse(entry!.valorNuevo!).email).toBe(user.email);
  });

  it('EARS-AUDIT-03: UPDATE stores field diff with campo_modificado', async () => {
    const auditLogModel = app.get<typeof AuditLog>(getModelToken(AuditLog));
    const user = await createTestUser();

    await request(app.getHttpServer())
      .put(`/api/v1/users/${user.user_id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Diff Name For Audit' })
      .expect(200);

    const entry = await auditLogModel.findOne({
      where: {
        accion: AuditAction.UPDATE,
        registroId: user.user_id,
        campoModificado: 'full_name',
      },
      order: [['timestamp', 'DESC']],
    });

    expect(entry).not.toBeNull();
    expect(entry?.valorAnterior).toBeTruthy();
    expect(entry?.valorNuevo).toBeTruthy();
  });

  it('EARS-AUDIT-04: soft-delete stores DELETE with valor_anterior', async () => {
    const auditLogModel = app.get<typeof AuditLog>(getModelToken(AuditLog));
    const userModel = app.get<typeof User>(getModelToken(User));
    const user = await createTestUser();

    const userInstance = await userModel.findByPk(user.user_id);
    await userInstance!.destroy();

    const entry = await auditLogModel.findOne({
      where: { accion: AuditAction.DELETE, registroId: user.user_id },
    });

    expect(entry).not.toBeNull();
    expect(entry?.valorAnterior).toBeTruthy();
    expect(entry?.valorNuevo).toBeNull();
  });

  it('EARS-AUDIT-05: populates usuario_id, ip_address and user_agent from request context', async () => {
    const auditLogModel = app.get<typeof AuditLog>(getModelToken(AuditLog));
    const user = await createTestUser();

    const entry = await auditLogModel.findOne({
      where: { accion: AuditAction.INSERT, registroId: user.user_id },
    });

    expect(entry?.usuarioId).toBeTruthy();
    expect(entry?.ipAddress).toBeTruthy();
    expect(entry?.usuarioId).not.toBe(SYSTEM_USER_ID);
  });

  it('EARS-AUDIT-06: uses system actor when no request context is available', async () => {
    const auditLogModel = app.get<typeof AuditLog>(getModelToken(AuditLog));
    const roleModel = app.get<typeof Role>(getModelToken(Role));

    const roleName = `EARS-Audit-${Date.now()}`;
    const role = await roleModel.create({
      name: roleName,
      description: 'System context test',
      permissions: [{ action: 'read', subject: 'Lead' }],
      isSystem: false,
    });

    const entry = await auditLogModel.findOne({
      where: {
        accion: AuditAction.INSERT,
        tabla: 'roles',
        registroId: role.roleId,
      },
    });

    expect(entry?.usuarioId).toBe(SYSTEM_USER_ID);

    await roleModel.destroy({ where: { roleId: role.roleId }, force: true });
  });

  it('EARS-AUDIT-07: records LOGIN security event', async () => {
    const auditLogModel = app.get<typeof AuditLog>(getModelToken(AuditLog));
    const user = await createTestUser();

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'AuditPass123!' })
      .expect(200);

    const entry = await auditLogModel.findOne({
      where: { accion: AuditAction.LOGIN, registroId: user.user_id },
      order: [['timestamp', 'DESC']],
    });

    expect(entry).not.toBeNull();
  });

  it('EARS-AUDIT-08: records STATE_CHANGE via central audit service', async () => {
    const auditLogModel = app.get<typeof AuditLog>(getModelToken(AuditLog));
    const auditService = app.get(AuditService);
    const user = await createTestUser();

    await auditService.recordSecurityEvent({
      accion: AuditAction.STATE_CHANGE,
      tabla: 'opportunities',
      registro_id: user.user_id,
      campo_modificado: 'estado',
      valor_anterior: JSON.stringify('MOFU'),
      valor_nuevo: JSON.stringify('SQL'),
    });

    const entry = await auditLogModel.findOne({
      where: {
        accion: AuditAction.STATE_CHANGE,
        registroId: user.user_id,
        campoModificado: 'estado',
      },
    });

    expect(entry).not.toBeNull();
  });

  it('EARS-AUDIT-09: records EXPORT via central audit service', async () => {
    const auditLogModel = app.get<typeof AuditLog>(getModelToken(AuditLog));
    const auditService = app.get(AuditService);
    const user = await createTestUser();

    await auditService.recordSecurityEvent({
      accion: AuditAction.EXPORT,
      tabla: 'users',
      registro_id: user.user_id,
      contexto: { format: 'csv' },
    });

    const entry = await auditLogModel.findOne({
      where: { accion: AuditAction.EXPORT, registroId: user.user_id },
    });

    expect(entry).not.toBeNull();
  });

  it('EARS-AUDIT-12: non-Admin receives 403 on audit-log query', async () => {
    const email = uniqueTestEmail('ears-kam-audit');
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email,
        password: 'KamPass123!',
        full_name: 'KAM Audit Test',
        role_id: kamRoleId,
      })
      .expect(201);

    createdUserIds.push(createResponse.body.user_id);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'KamPass123!' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .expect(403);
  });

  it('EARS-AUDIT-13: Admin can filter audit log with pagination', async () => {
    const user = await createTestUser();

    const response = await request(app.getHttpServer())
      .get('/api/v1/audit-log')
      .query({
        tabla: 'users',
        registro_id: user.user_id,
        accion: AuditAction.INSERT,
        page: 1,
        limit: 10,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.items).toBeDefined();
    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(10);
    expect(
      response.body.items.every(
        (item: { tabla: string; registro_id: string }) =>
          item.tabla === 'users' && item.registro_id === user.user_id,
      ),
    ).toBe(true);
  });
});
