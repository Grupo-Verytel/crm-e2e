import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import request from 'supertest';
import { App } from 'supertest/types';
import { Op } from 'sequelize';
import {
  createE2eApp,
  decodeJwtPayload,
  uniqueTestEmail,
} from './helpers/e2e-app.helper';
import { User } from '../src/modules/auth/models/user.model';
import { AuditLog } from '../src/modules/audit/models/audit-log.model';
import { AuditAction } from '../src/modules/audit/models/audit-action.enum';
import { LOCKOUT_THRESHOLD } from '../src/modules/auth/constants/auth.constants';

describe('Auth module (EARS)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let adminRoleId: string;
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

    adminRoleId = rolesResponse.body.find(
      (role: { name: string }) => role.name === 'Admin',
    ).role_id;
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

  async function createTestUser(
    overrides: Partial<{
      email: string;
      password: string;
      full_name: string;
      role_id: string;
      is_active: boolean;
    }> = {},
  ) {
    const payload = {
      email: overrides.email ?? uniqueTestEmail('ears-user'),
      password: overrides.password ?? 'TestPass123!',
      full_name: overrides.full_name ?? 'EARS Test User',
      role_id: overrides.role_id ?? kamRoleId,
      is_active: overrides.is_active ?? true,
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);

    createdUserIds.push(response.body.user_id);
    return { payload, response };
  }

  it('EARS-AUTH-01: returns access and refresh tokens on valid login', async () => {
    const { payload } = await createTestUser();

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    expect(response.body.access_token).toBeDefined();
    expect(response.body.refresh_token).toBeDefined();
    expect(response.body.expires_in).toBeDefined();
  });

  it('EARS-AUTH-02: returns 401 with generic message for invalid credentials', async () => {
    const missingEmail = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'missing@test.local', password: 'WrongPass123!' })
      .expect(401);

    const { payload } = await createTestUser();
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: 'WrongPass123!' })
      .expect(401);

    expect(missingEmail.body.message).toBe('Invalid credentials');
    expect(wrongPassword.body.message).toBe('Invalid credentials');
  });

  it('EARS-AUTH-03: stores bcrypt hash and never returns password_hash in responses', async () => {
    const { payload, response } = await createTestUser();

    expect(response.body.password_hash).toBeUndefined();

    const userModel = app.get<typeof User>(getModelToken(User));
    const stored = await userModel.findByPk(response.body.user_id);
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored?.passwordHash).not.toBe(payload.password);

    const meResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    const profile = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${meResponse.body.access_token}`)
      .expect(200);

    expect(profile.body.password_hash).toBeUndefined();
  });

  it('EARS-AUTH-04: blocks login when is_active is false with 403', async () => {
    const { payload } = await createTestUser({ is_active: false });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(403);

    expect(response.body.code).toBe('USER_INACTIVE');
  });

  it('EARS-AUTH-05: increments failed_login_attempts on failed login', async () => {
    const { payload, response } = await createTestUser();
    const userModel = app.get<typeof User>(getModelToken(User));

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: 'WrongPass123!' })
      .expect(401);

    const user = await userModel.findByPk(response.body.user_id);
    expect(user?.failedLoginAttempts).toBe(1);
  });

  it('EARS-AUTH-06: locks user after 5 failed attempts', async () => {
    const { payload, response } = await createTestUser();
    const userModel = app.get<typeof User>(getModelToken(User));

    for (let attempt = 0; attempt < LOCKOUT_THRESHOLD; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: payload.email, password: 'WrongPass123!' })
        .expect(401);
    }

    const lockedUser = await userModel.findByPk(response.body.user_id);
    expect(lockedUser?.failedLoginAttempts).toBe(LOCKOUT_THRESHOLD);
    expect(lockedUser?.lockedUntil).not.toBeNull();
    expect(lockedUser!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(401);
  });

  it('EARS-AUTH-07: resets failed_login_attempts and updates last_login_at on success', async () => {
    const { payload, response } = await createTestUser();
    const userModel = app.get<typeof User>(getModelToken(User));

    await userModel.update(
      { failedLoginAttempts: 3, lockedUntil: null },
      { where: { userId: response.body.user_id } },
    );

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    const user = await userModel.findByPk(response.body.user_id);
    expect(user?.failedLoginAttempts).toBe(0);
    expect(user?.lastLoginAt).not.toBeNull();
  });

  it('EARS-AUTH-08: access token expires per JWT_EXPIRES_IN and includes user_id and role', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);

    expect(loginResponse.body.expires_in).toBe(
      process.env.JWT_EXPIRES_IN ?? '15m',
    );

    const payload = decodeJwtPayload(loginResponse.body.access_token);
    expect(payload.sub).toBeDefined();
    expect(payload.role).toBe('Admin');
    expect(payload.exp).toBeDefined();
  });

  it('EARS-AUTH-09: rotates refresh token on refresh', async () => {
    const { payload } = await createTestUser();

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: loginResponse.body.refresh_token })
      .expect(200);

    expect(refreshResponse.body.access_token).toBeDefined();
    expect(refreshResponse.body.refresh_token).not.toBe(
      loginResponse.body.refresh_token,
    );

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: loginResponse.body.refresh_token })
      .expect(401);
  });

  it('EARS-AUTH-10: revokes refresh token on logout', async () => {
    const { payload } = await createTestUser();

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .send({ refresh_token: loginResponse.body.refresh_token })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: loginResponse.body.refresh_token })
      .expect(401);
  });

  it('EARS-AUTH-11: returns 401 for revoked or expired refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'a'.repeat(64) })
      .expect(401);

    expect(response.body.message).toContain('Invalid or expired refresh token');
  });

  it('EARS-AUTH-12: denies protected routes without JWT (deny-by-default)', async () => {
    await request(app.getHttpServer()).get('/api/v1/users').expect(401);
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('EARS-AUTH-15: admin creates user with unique email, valid role and hashed password', async () => {
    const email = uniqueTestEmail('ears-create');
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email,
        password: 'CreatePass123!',
        full_name: 'Created By Admin',
        role_id: kamRoleId,
      })
      .expect(201);

    createdUserIds.push(response.body.user_id);
    expect(response.body.email).toBe(email);
    expect(response.body.role_id).toBe(kamRoleId);

    const userModel = app.get<typeof User>(getModelToken(User));
    const stored = await userModel.findByPk(response.body.user_id);
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('EARS-AUTH-16: returns 409 when creating user with duplicate email', async () => {
    const { payload } = await createTestUser();

    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: payload.email,
        password: 'AnotherPass123!',
        full_name: 'Duplicate Email',
        role_id: kamRoleId,
      })
      .expect(409);

    expect(response.body.code).toBe('EMAIL_CONFLICT');
  });

  it('EARS-AUTH-17: non-Admin cannot access users or roles endpoints', async () => {
    const { payload } = await createTestUser({ role_id: kamRoleId });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    const kamToken = loginResponse.body.access_token;

    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${kamToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${kamToken}`)
      .expect(403);
  });

  it('EARS-AUTH-18: records LOGIN and user/role writes in audit_log', async () => {
    const auditLogModel = app.get<typeof AuditLog>(getModelToken(AuditLog));

    const { payload, response } = await createTestUser();
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    const loginAudit = await auditLogModel.findOne({
      where: {
        accion: AuditAction.LOGIN,
        registroId: response.body.user_id,
      },
      order: [['timestamp', 'DESC']],
    });
    expect(loginAudit).not.toBeNull();

    const insertAudit = await auditLogModel.findOne({
      where: {
        accion: AuditAction.INSERT,
        tabla: 'users',
        registroId: response.body.user_id,
      },
    });
    expect(insertAudit).not.toBeNull();

    await request(app.getHttpServer())
      .put(`/api/v1/users/${response.body.user_id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'EARS Updated Name' })
      .expect(200);

    const userUpdateAudit = await auditLogModel.findOne({
      where: {
        accion: AuditAction.UPDATE,
        tabla: 'users',
        registroId: response.body.user_id,
      },
      order: [['timestamp', 'DESC']],
    });
    expect(userUpdateAudit).not.toBeNull();

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .send({ refresh_token: loginResponse.body.refresh_token })
      .expect(200);
  });
});
