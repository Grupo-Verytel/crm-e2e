import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { OuvResultado } from '../../discovery/models/enums/ouv.enums';
import { Ouv } from '../../discovery/models/ouv.model';
import { OuvsService } from '../../discovery/services/ouvs.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { StatusChangeDto } from '../dtos/status-change.dto';
import { ProjectStatusEvent } from '../models/project-status-event.model';
import { PmoApiClient } from './pmo-api.client';
import {
  PROJECT_STATUS_CHANGED_EVENT,
  ProjectExecutionService,
} from './project-execution.service';

const OUV_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const EVENT_ID = '8b1a0c2e-1f4b-4a44-9c3e-1d2e3f4a5b6c';
const COMERCIAL_ID = 'c0ffee00-1111-4222-8333-444455556666';

function buildDto(overrides: Partial<StatusChangeDto> = {}): StatusChangeDto {
  return {
    referenceId: OUV_ID,
    newStatus: '1A',
    occurredAt: '2026-06-15T14:30:00.000Z',
    externalEventId: EVENT_ID,
    comment: 'Proyecto COTA',
    ...overrides,
  };
}

function buildOuv(overrides: Partial<Ouv> = {}): Ouv {
  return {
    ouvId: OUV_ID,
    consecutivo: 'OUV-0001',
    comercialId: COMERCIAL_ID,
    titulo: 'Red WAN Alcaldía de Cota',
    resultado: OuvResultado.Ganada,
    montoFinal: '100000.00',
    ...overrides,
  } as Ouv;
}

describe('ProjectExecutionService — PMO status-change ingestion', () => {
  function createService(overrides?: {
    ouv?: Ouv | null;
    existingEvent?: Partial<ProjectStatusEvent> | null;
    transition?: jest.Mock;
    create?: jest.Mock;
    pmoApi?: Partial<PmoApiClient>;
  }) {
    const transition =
      overrides?.transition ?? jest.fn().mockResolvedValue(undefined);
    const create =
      overrides?.create ??
      jest.fn().mockResolvedValue({
        projectStatusEventId: 'evt-1',
        externalEventId: EVENT_ID,
      });
    const findOne = jest
      .fn()
      .mockResolvedValue(overrides?.existingEvent ?? null);

    const service = new ProjectExecutionService(
      {
        transaction: (callback: (t: unknown) => Promise<unknown>) =>
          callback({}),
      } as unknown as Sequelize,
      { findOne, create } as unknown as typeof ProjectStatusEvent,
      {
        findById: jest
          .fn()
          .mockResolvedValue(
            overrides?.ouv === undefined ? buildOuv() : overrides.ouv,
          ),
      } as unknown as OuvsService,
      { transition } as unknown as WorkflowEngineService,
      (overrides?.pmoApi ?? {}) as PmoApiClient,
    );

    return { service, transition, create, findOne };
  }

  it('EARS-PMO-01: when a status change arrives, records it and notifies the comercial', async () => {
    const { service, transition, create } = createService();

    const ack = await service.registerStatusChange(buildDto());

    expect(ack.duplicate).toBe(false);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        ouvId: OUV_ID,
        externalEventId: EVENT_ID,
        newStatus: '1A',
      }),
      expect.anything(),
    );
    expect(transition).toHaveBeenCalledWith(
      expect.anything(),
      OUV_ID,
      PROJECT_STATUS_CHANGED_EVENT,
      expect.objectContaining({
        estadoNuevo: '1A',
        payload: expect.objectContaining({
          comercial_id: COMERCIAL_ID,
        }) as unknown,
      }),
      expect.anything(),
    );
  });

  it('EARS-PMO-02: if the event was already ingested, then it is acknowledged without re-notifying', async () => {
    const { service, transition, create } = createService({
      existingEvent: {
        projectStatusEventId: 'evt-1',
        externalEventId: EVENT_ID,
      },
    });

    const ack = await service.registerStatusChange(buildDto());

    expect(ack.duplicate).toBe(true);
    expect(create).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });

  it('EARS-PMO-03: if the referenceId matches no OUV, then the webhook is rejected with 404', async () => {
    const { service, create } = createService({ ouv: null });

    await expect(
      service.registerStatusChange(buildDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('EARS-PMO-04: the status is stored verbatim and truncated only for the notification', async () => {
    const largeStatus = 'E'.repeat(60);
    const { service, transition, create } = createService();

    await service.registerStatusChange(buildDto({ newStatus: largeStatus }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: largeStatus }),
      expect.anything(),
    );
    expect(transition).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ estadoNuevo: 'E'.repeat(40) }),
      expect.anything(),
    );
  });

  it('EARS-PMO-05: when the OUV exists, execution indicators are read through to the PMO', async () => {
    const getExecution = jest.fn().mockResolvedValue({ ouvId: OUV_ID });
    const { service } = createService({ pmoApi: { getExecution } });

    await expect(service.getExecution(OUV_ID)).resolves.toEqual({
      ouvId: OUV_ID,
    });
    expect(getExecution).toHaveBeenCalledWith(OUV_ID);
  });

  it('EARS-PMO-06: if the OUV does not exist, then the PMO is not queried', async () => {
    const getStateHistory = jest.fn();
    const { service } = createService({
      ouv: null,
      pmoApi: { getStateHistory },
    });

    await expect(service.getStateHistory(OUV_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(getStateHistory).not.toHaveBeenCalled();
  });

  describe('opening the delivery project in the PMO', () => {
    const fechas = {
      fechaInicio: '2026-09-01T00:00:00.000Z',
      fechaFin: '2027-03-01T00:00:00.000Z',
    };

    it('EARS-PMO-07: when a won OUV is sent to the PMO, the OUV data fills the payload', async () => {
      const createProject = jest.fn().mockResolvedValue({ PRO_NCODE: 123 });
      const { service } = createService({ pmoApi: { createProject } });

      await expect(service.createPmoProject(OUV_ID, fechas)).resolves.toEqual({
        ouvId: OUV_ID,
        projectId: 123,
      });
      expect(createProject).toHaveBeenCalledWith({
        PRO_CNAME: 'Red WAN Alcaldía de Cota',
        PRO_DASSIGNMENT: expect.any(String) as unknown,
        PRO_DSTART: fechas.fechaInicio,
        PRO_DEND: fechas.fechaFin,
        OUV_ID: OUV_ID,
        N_CONTRACT_VALUE: 100000,
      });
    });

    it('EARS-PMO-08: optional fields absent from the request are absent from the payload, so the PMO column DEFAULTs apply', async () => {
      const createProject = jest.fn().mockResolvedValue({ PRO_NCODE: 123 });
      const { service } = createService({
        ouv: buildOuv({ montoFinal: null }),
        pmoApi: { createProject },
      });

      await service.createPmoProject(OUV_ID, fechas);

      const [payload] = createProject.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(Object.keys(payload).sort()).toEqual([
        'OUV_ID',
        'PRO_CNAME',
        'PRO_DASSIGNMENT',
        'PRO_DEND',
        'PRO_DSTART',
      ]);
    });

    it('EARS-PMO-09: explicit values override the OUV defaults', async () => {
      const createProject = jest.fn().mockResolvedValue({ PRO_NCODE: 123 });
      const { service } = createService({ pmoApi: { createProject } });

      await service.createPmoProject(OUV_ID, {
        ...fechas,
        nombreProyecto: 'Implementación módulo facturación',
        fechaAsignacion: '2026-08-22T00:00:00.000Z',
        tipoProyecto: 'RECURRING',
        valorContrato: 250000,
        costosEsperados: 60000,
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          PRO_CNAME: 'Implementación módulo facturación',
          PRO_DASSIGNMENT: '2026-08-22T00:00:00.000Z',
          PRO_CPROJECT_TYPE: 'RECURRING',
          N_CONTRACT_VALUE: 250000,
          N_EXPECTED_TOTAL_COSTS: 60000,
        }),
      );
    });

    it('EARS-PMO-10: if the OUV is not Ganada, then the PMO is not called', async () => {
      const createProject = jest.fn();
      const { service } = createService({
        ouv: buildOuv({ resultado: OuvResultado.EnCurso }),
        pmoApi: { createProject },
      });

      await expect(
        service.createPmoProject(OUV_ID, fechas),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createProject).not.toHaveBeenCalled();
    });

    it('EARS-PMO-11: if fechaFin precedes fechaInicio, then the PMO is not called', async () => {
      const createProject = jest.fn();
      const { service } = createService({ pmoApi: { createProject } });

      await expect(
        service.createPmoProject(OUV_ID, {
          fechaInicio: '2027-03-01T00:00:00.000Z',
          fechaFin: '2026-09-01T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createProject).not.toHaveBeenCalled();
    });

    it('EARS-PMO-12: if the OUV does not exist, then the PMO is not called', async () => {
      const createProject = jest.fn();
      const { service } = createService({
        ouv: null,
        pmoApi: { createProject },
      });

      await expect(
        service.createPmoProject(OUV_ID, fechas),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(createProject).not.toHaveBeenCalled();
    });
  });
});
