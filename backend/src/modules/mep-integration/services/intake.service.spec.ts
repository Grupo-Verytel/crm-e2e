import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Op } from 'sequelize';
import { CommercialInteraction } from '../models';
import { IntakeService } from './intake.service';

describe('IntakeService — §6.1 elegibilidad', () => {
  let service: IntakeService;
  let findAll: jest.Mock;

  beforeEach(async () => {
    findAll = jest.fn().mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        IntakeService,
        {
          provide: getModelToken(CommercialInteraction),
          useValue: { findAll },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: () => 'test-cursor-secret-at-least-32-chars!!',
          },
        },
      ],
    }).compile();

    service = module.get(IntakeService);
  });

  it('TS-INT-01: el pull exige eligible_for_mep y no filtra por polling_status', async () => {
    await service.listInteractions({});

    expect(findAll).toHaveBeenCalledTimes(1);
    const where = findAll.mock.calls[0][0].where as Record<string, unknown>;
    const and = (where[Op.and] as Record<string, unknown>[]) ?? [];

    expect(and).toEqual(expect.arrayContaining([{ eligibleForMep: true }]));
    expect(and.some((c) => c && 'pollingStatus' in c)).toBe(false);
  });

  it('TS-INT-ACU-01 / OUV-0388: acuse no excluye filas del pull', async () => {
    await service.listInteractions({});

    const where = findAll.mock.calls[0][0].where as Record<string, unknown>;
    expect(JSON.stringify(where)).not.toContain('polling');
  });

  it('TS-INT-ACU-02: findByRef no filtra por polling_status', async () => {
    const findOne = jest.fn().mockResolvedValue({ crmInteractionRef: 'int_x' });
    const module = await Test.createTestingModule({
      providers: [
        IntakeService,
        {
          provide: getModelToken(CommercialInteraction),
          useValue: { findAll, findOne },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: () => 'test-cursor-secret-at-least-32-chars!!',
          },
        },
      ],
    }).compile();

    const svc = module.get(IntakeService);
    await svc.findByRef('int_x');

    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { crmInteractionRef: 'int_x' },
      }),
    );
  });
});
