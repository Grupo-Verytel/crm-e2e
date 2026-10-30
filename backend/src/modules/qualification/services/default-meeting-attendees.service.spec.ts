import { BadRequestException, ConflictException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CreateDefaultMeetingAttendeeDto,
  UpdateDefaultMeetingAttendeeDto,
} from '../dtos/default-meeting-attendee.dto';
import { DefaultMeetingAttendee } from '../models/default-meeting-attendee.model';
import { DefaultMeetingAttendeesService } from './default-meeting-attendees.service';

const NOW = new Date('2026-10-29T12:00:00.000Z');

function storedRow(overrides?: Record<string, unknown>) {
  const row = {
    defaultMeetingAttendeeId: '11111111-1111-4111-8111-111111111111',
    email: 'erobles@grupoverytel.com',
    name: null as string | null,
    sortOrder: 1,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    update: jest.fn(async (patch: Record<string, unknown>) => {
      Object.assign(row, patch);
    }),
    destroy: jest.fn(async () => undefined),
    ...overrides,
  };
  return row;
}

function build(options?: {
  existing?: ReturnType<typeof storedRow> | null;
  max?: number | null;
  createError?: unknown;
}) {
  const created = storedRow({
    defaultMeetingAttendeeId: '22222222-2222-4222-8222-222222222222',
    sortOrder: 4,
  });
  const model = {
    findAll: jest.fn().mockResolvedValue([storedRow()]),
    findOne: jest.fn().mockResolvedValue(options?.existing ?? null),
    findByPk: jest.fn().mockResolvedValue(options?.existing ?? null),
    max: jest.fn().mockResolvedValue(
      options && 'max' in options ? options.max : 3,
    ),
    create: jest.fn(async (values: Record<string, unknown>) => {
      if (options?.createError) {
        throw options.createError;
      }
      Object.assign(created, values);
      return created;
    }),
  };
  const service = new DefaultMeetingAttendeesService(
    model as unknown as typeof DefaultMeetingAttendee,
  );
  return { service, model, created };
}

describe('DefaultMeetingAttendeesService', () => {
  it('REQ-11: lists live rows ordered by sort_order then email', async () => {
    const { service, model } = build();
    const result = await service.list();
    expect(model.findAll).toHaveBeenCalledWith({
      order: [
        ['sortOrder', 'ASC'],
        ['email', 'ASC'],
      ],
    });
    expect(result.items[0]).toMatchObject({
      default_meeting_attendee_id: '11111111-1111-4111-8111-111111111111',
      email: 'erobles@grupoverytel.com',
      is_active: true,
      sort_order: 1,
    });
  });

  it('REQ-11: creates an active row with the next sort_order and a lowercased email', async () => {
    const { service, model, created } = build();
    const result = await service.create({
      email: '  Nueva@GrupoVerytel.com ',
      name: '  Nueva ',
    });
    expect(model.create).toHaveBeenCalledWith({
      email: 'nueva@grupoverytel.com',
      name: 'Nueva',
      sortOrder: 4,
      isActive: true,
    });
    expect(result.email).toBe(created.email);
    expect(result.sort_order).toBe(4);
    expect(result.is_active).toBe(true);
  });

  it('REQ-11: edits the name and toggles is_active', async () => {
    const existing = storedRow();
    const { service } = build({ existing });
    const renamed = await service.update(existing.defaultMeetingAttendeeId, {
      name: 'Elena',
    });
    expect(renamed.name).toBe('Elena');
    const inactive = await service.update(existing.defaultMeetingAttendeeId, {
      is_active: false,
    });
    expect(inactive.is_active).toBe(false);
  });

  it('REQ-11: soft-deletes through the model destroy', async () => {
    const existing = storedRow();
    const { service } = build({ existing });
    await expect(service.remove(existing.defaultMeetingAttendeeId)).resolves.toEqual({
      deleted: true,
    });
    expect(existing.destroy).toHaveBeenCalledTimes(1);
  });

  it('REQ-13: rejects a live duplicate even when that row is inactive', async () => {
    const { service } = build({ existing: storedRow({ isActive: false }) });
    await expect(
      service.create({ email: 'erobles@grupoverytel.com' }),
    ).rejects.toMatchObject({
      response: {
        code: 'CONFLICT',
        message: 'Ese correo ya está en la lista.',
      },
    });
    await expect(
      service.create({ email: 'erobles@grupoverytel.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('REQ-13: accepts the email again after the live row is gone', async () => {
    const { service, model } = build({ existing: null, max: null });
    const result = await service.create({ email: 'erobles@grupoverytel.com' });
    expect(model.findOne).toHaveBeenCalledWith({
      where: { email: 'erobles@grupoverytel.com' },
    });
    expect(result.sort_order).toBe(1);
  });

  it('REQ-13: maps a unique-index collision to 409', async () => {
    const { service } = build({
      createError: new UniqueConstraintError({}),
    });
    await expect(
      service.create({ email: 'otro@grupoverytel.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('REQ-13: rejects an empty patch and a missing id', async () => {
    const { service } = build({ existing: null });
    await expect(service.update('missing', {})).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_ERROR',
        message: 'No hay cambios para guardar.',
      },
    });
    await expect(service.update('missing', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.remove('missing')).rejects.toMatchObject({
      response: {
        code: 'NOT_FOUND',
        message: 'No se encontró el invitado.',
      },
    });
    await expect(service.remove('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('REQ-13: the validation pipe rejects an invalid email with the Spanish message', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(
        { email: 'no-es-correo' },
        { type: 'body', metatype: CreateDefaultMeetingAttendeeDto },
      ),
    ).rejects.toMatchObject({
      response: { message: expect.arrayContaining(['El correo no es válido.']) },
    });
  });

  it('REQ-13: the validation pipe rejects a name longer than 120 characters', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(
        { name: 'a'.repeat(121), is_active: true },
        { type: 'body', metatype: UpdateDefaultMeetingAttendeeDto },
      ),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining([
          'El nombre no puede pasar de 120 caracteres.',
        ]),
      },
    });
  });

  it('forbids an email field on update', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(
        { email: 'otro@grupoverytel.com', name: 'Otro' },
        { type: 'body', metatype: UpdateDefaultMeetingAttendeeDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('REQ-14: the service does not write audit_log', () => {
    const source = readFileSync(
      join(__dirname, 'default-meeting-attendees.service.ts'),
      'utf8',
    );
    expect(source).not.toContain('audit_log');
    expect(source).not.toContain('AuditWriterService');
    expect(source).not.toContain('AuditService');
  });
});
