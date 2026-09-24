import { BadRequestException } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { CreateInteractionDto } from '../dtos/create-interaction.dto';
import { InteractionCanal, InteractionTipo } from '../models/enums/interaction.enums';
import { Interaction } from '../models/interaction.model';
import { Lead } from '../models/lead.model';
import { InteractionsService } from './interactions.service';

describe('InteractionsService SQL registration', () => {
  const leadId = 'lead-1';
  const sqlId = 'sql-1';
  const responsableId = 'user-token';
  const dto = {
    tipo: InteractionTipo.Llamada,
    canal: InteractionCanal.Telefono,
    descripcion: 'Llamada de seguimiento',
  } as CreateInteractionDto;

  function build() {
    const transaction = { id: 'tx-1' };
    const leadUpdate = jest.fn().mockResolvedValue(undefined);
    const lead = {
      leadId,
      estado: 'SQL',
      update: leadUpdate,
    };
    const created = {
      interactionId: 'int-1',
      leadId,
      sqlId,
      tipo: dto.tipo,
      canal: dto.canal,
      subtipo: null,
      descripcion: dto.descripcion,
      resultado: null,
      campanaId: null,
      responsableId,
      fecha: new Date('2026-09-23T15:00:00.000Z'),
      createdAt: new Date('2026-09-23T15:00:00.000Z'),
      updatedAt: new Date('2026-09-23T15:00:00.000Z'),
    };
    const loaded = {
      ...created,
      responsable: { fullName: 'Ana Soporte', role: { name: 'SoporteComercial' } },
    };
    const interactionModel = {
      create: jest.fn().mockResolvedValue(created),
      findByPk: jest.fn().mockResolvedValue(loaded),
      findAll: jest.fn(),
      count: jest.fn(),
    };
    const leadModel = {
      findByPk: jest.fn().mockResolvedValue(lead),
    };
    const sequelize = {
      transaction: jest.fn(async (work: (tx: typeof transaction) => unknown) =>
        work(transaction),
      ),
    };

    const service = new InteractionsService(
      sequelize as unknown as Sequelize,
      interactionModel as unknown as typeof Interaction,
      leadModel as unknown as typeof Lead,
    );

    return { service, transaction, leadUpdate, interactionModel, lead };
  }

  it('A1: createForSql updates only fecha_ultima_interaccion and keeps lead.estado', async () => {
    const { service, leadUpdate, lead } = build();

    await service.createForSql(leadId, sqlId, dto, responsableId);

    expect(leadUpdate).toHaveBeenCalledTimes(1);
    expect(leadUpdate.mock.calls[0][0]).toEqual({
      fechaUltimaInteraccion: expect.any(Date),
    });
    expect(lead.estado).toBe('SQL');
  });

  it('A2: insert and fecha update share the same transaction', async () => {
    const { service, transaction, leadUpdate, interactionModel } = build();

    await service.createForSql(leadId, sqlId, dto, responsableId);

    expect(interactionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId,
        sqlId,
        responsableId,
      }),
      { transaction },
    );
    expect(leadUpdate).toHaveBeenCalledWith(
      { fechaUltimaInteraccion: expect.any(Date) },
      { transaction },
    );
  });

  it('stores the token user as responsable_id and the derived lead_id', async () => {
    const { service, interactionModel } = build();

    const saved = await service.createForSql(leadId, sqlId, dto, responsableId);

    expect(interactionModel.create.mock.calls[0][0].responsableId).toBe(responsableId);
    expect(interactionModel.create.mock.calls[0][0].leadId).toBe(leadId);
    expect(saved.etapa).toBe('SQL');
    expect(saved.responsable_nombre).toBe('Ana Soporte');
    expect(saved.responsable_rol).toBe('SoporteComercial');
  });

  it('lists etapa Previa or SQL and the author name and role in one query', async () => {
    const { service, interactionModel, lead } = build();
    interactionModel.findAll.mockResolvedValue([
      {
        interactionId: 'new',
        leadId,
        sqlId: 'sql-1',
        tipo: InteractionTipo.Llamada,
        canal: InteractionCanal.Telefono,
        subtipo: null,
        descripcion: null,
        resultado: null,
        campanaId: null,
        responsableId,
        fecha: new Date('2026-09-23T16:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        responsable: { fullName: 'Ejecutivo Uno', role: { name: 'EjecutivoComercial' } },
      },
      {
        interactionId: 'old',
        leadId,
        sqlId: null,
        tipo: InteractionTipo.Email,
        canal: InteractionCanal.Email,
        subtipo: null,
        descripcion: null,
        resultado: null,
        campanaId: null,
        responsableId: 'user-2',
        fecha: new Date('2026-09-01T16:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        responsable: null,
      },
    ]);

    const rows = await service.listByLead(lead.leadId);

    expect(interactionModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { leadId },
        include: [expect.objectContaining({ as: 'responsable' })],
      }),
    );
    expect(rows[0].etapa).toBe('SQL');
    expect(rows[0].responsable_nombre).toBe('Ejecutivo Uno');
    expect(rows[0].responsable_rol).toBe('EjecutivoComercial');
    expect(rows[1].etapa).toBe('Previa');
    expect(rows[1].responsable_nombre).toBeNull();
  });
});

describe('interaction fecha window of 96 hours', () => {
  const NOW = new Date('2026-09-24T15:00:00.000Z');
  const EXACTLY_96H = '2026-09-20T15:00:00.000Z';
  const NINETY_SIX_H_PLUS_ONE_MIN = '2026-09-20T14:59:00.000Z';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function build() {
    const transaction = { id: 'tx-1' };
    const lead = {
      leadId: 'lead-1',
      estado: 'SQL',
      update: jest.fn().mockResolvedValue(undefined),
    };
    const interactionModel = {
      create: jest.fn().mockResolvedValue({
        interactionId: 'int-1',
        leadId: 'lead-1',
        sqlId: null,
        tipo: InteractionTipo.Llamada,
        canal: InteractionCanal.Telefono,
        subtipo: null,
        descripcion: null,
        resultado: null,
        campanaId: null,
        responsableId: 'user-token',
        fecha: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      }),
      findByPk: jest.fn().mockResolvedValue(null),
      findAll: jest.fn(),
      count: jest.fn(),
    };
    const service = new InteractionsService(
      {
        transaction: jest.fn(async (work: (tx: typeof transaction) => unknown) =>
          work(transaction),
        ),
      } as unknown as Sequelize,
      interactionModel as unknown as typeof Interaction,
      { findByPk: jest.fn().mockResolvedValue(lead) } as unknown as typeof Lead,
    );
    return { service, interactionModel };
  }

  const fechaDto = (fecha: string) =>
    ({
      tipo: InteractionTipo.Llamada,
      canal: InteractionCanal.Telefono,
      fecha,
    }) as CreateInteractionDto;

  it.each(['create', 'createForSql'] as const)(
    '%s accepts a date exactly 96 hours before registration',
    async (method) => {
      const { service, interactionModel } = build();
      const run =
        method === 'create'
          ? service.create('lead-1', fechaDto(EXACTLY_96H), 'user-token')
          : service.createForSql('lead-1', 'sql-1', fechaDto(EXACTLY_96H), 'user-token');

      await expect(run).resolves.toBeDefined();
      const fecha = expect.objectContaining({ fecha: new Date(EXACTLY_96H) });
      if (method === 'createForSql') {
        expect(interactionModel.create).toHaveBeenCalledWith(fecha, expect.anything());
      } else {
        expect(interactionModel.create).toHaveBeenCalledWith(fecha);
      }
    },
  );

  it.each(['create', 'createForSql'] as const)(
    '%s rejects a date 96 hours and 1 minute before registration',
    async (method) => {
      const { service, interactionModel } = build();
      const run =
        method === 'create'
          ? service.create('lead-1', fechaDto(NINETY_SIX_H_PLUS_ONE_MIN), 'user-token')
          : service.createForSql(
              'lead-1',
              'sql-1',
              fechaDto(NINETY_SIX_H_PLUS_ONE_MIN),
              'user-token',
            );

      await expect(run).rejects.toBeInstanceOf(BadRequestException);
      await expect(run).rejects.toMatchObject({
        response: { code: 'INTERACTION_DATE_TOO_OLD' },
      });
      expect(interactionModel.create).not.toHaveBeenCalled();
    },
  );
});

describe('CreateInteractionDto rejects a client-sent author', () => {
  it('forbidNonWhitelisted rejects responsable_id and lead_id', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          tipo: 'Llamada',
          canal: 'Telefono',
          responsable_id: 'spoofed-user',
          lead_id: 'spoofed-lead',
        },
        { type: 'body', metatype: CreateInteractionDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
