import { ConflictException } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { User } from '../../auth/models/user.model';
import { UsersService } from '../../auth/services/users.service';
import { RegisterAppointmentDto } from '../dtos/register-appointment.dto';
import { CanalOrigen, LeadEstado } from '../models/enums/lead.enums';
import { LeadContact } from '../models/lead-contact.model';
import { Lead } from '../models/lead.model';
import { Mql } from '../models/mql.model';
import type { NotificationPort } from '../ports/notification.port';
import { CampaignsService } from './campaigns.service';
import { LeadsService } from './leads.service';

describe('LeadsService channel flows', () => {
  function createService(overrides?: {
    leadModel?: Partial<typeof Lead>;
    leadContactModel?: Partial<typeof LeadContact>;
    mqlModel?: Partial<typeof Mql>;
    userModel?: Partial<typeof User>;
    sequelize?: Partial<Sequelize>;
    notifications?: Partial<NotificationPort>;
    usersService?: Partial<UsersService>;
  }): LeadsService {
    return new LeadsService(
      (overrides?.leadModel ?? {}) as typeof Lead,
      (overrides?.leadContactModel ?? {}) as typeof LeadContact,
      (overrides?.mqlModel ?? {}) as typeof Mql,
      (overrides?.userModel ?? {}) as typeof User,
      (overrides?.sequelize ?? {}) as Sequelize,
      {} as CampaignsService,
      (overrides?.usersService ?? {}) as UsersService,
      (overrides?.notifications ?? {}) as NotificationPort,
    );
  }

  it('EARS-20: resolves agency leads directly to MOFU', () => {
    const service = createService();

    expect(
      service.resolveInitialState(CanalOrigen.GeneracionDemandaAgencia),
    ).toBe(LeadEstado.MOFU);
    expect(service.resolveInitialState(CanalOrigen.Fabrica)).toBe(
      LeadEstado.TOFU,
    );
  });

  it('keeps TRADUCTOR_NEGOCIO blocked while its flow is TBD', () => {
    const service = createService();

    expect(() =>
      service.resolveInitialState(CanalOrigen.TraductorNegocio),
    ).toThrow(ConflictException);
  });

  it('EARS-21: registers an agency appointment and moves the lead to MQL_PENDING', async () => {
    const lead = {
      leadId: 'lead-1',
      canalOrigen: CanalOrigen.GeneracionDemandaAgencia,
      estado: LeadEstado.MOFU,
      empresaNombre: 'Acme',
      update: jest.fn(async (values: Partial<Lead>) => {
        Object.assign(lead, values);
      }),
    };
    const mqlCreate = jest.fn().mockResolvedValue({});
    const notify = jest.fn().mockResolvedValue(undefined);
    const service = createService({
      leadModel: { findByPk: jest.fn().mockResolvedValue(lead) },
      mqlModel: {
        findOne: jest.fn().mockResolvedValue(null),
        create: mqlCreate,
      },
      userModel: { findByPk: jest.fn().mockResolvedValue({ userId: 'user-1' }) },
      usersService: { isActiveWithRole: jest.fn().mockResolvedValue(true) },
      sequelize: {
        transaction: jest.fn(async (callback) => callback({})),
      },
      notifications: { notify },
    });
    jest
      .spyOn(service, 'toResponseDto')
      .mockReturnValue({ estado: LeadEstado.MqlPending } as never);

    const dto: RegisterAppointmentDto = {
      fecha_cita: '2026-07-20T10:00:00.000Z',
      comercial_asignado_id: 'commercial-1',
    };
    const result = await service.registerAppointment(
      'lead-1',
      dto,
      'support-1',
    );

    expect(mqlCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'lead-1',
        checklistId: null,
        calificadoPor: 'support-1',
      }),
      expect.any(Object),
    );
    expect(lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        citaAgendada: true,
        estado: LeadEstado.MqlPending,
      }),
      expect.any(Object),
    );
    expect(notify).toHaveBeenCalled();
    expect(result.estado).toBe(LeadEstado.MqlPending);
  });
});
