import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { UsersService } from '../../auth/services/users.service';
import { CreateInteractionDto } from '../../demand-generation/dtos/create-interaction.dto';
import { InteractionCanal, InteractionTipo } from '../../demand-generation/models/enums/interaction.enums';
import { SqlEstado } from '../../demand-generation/models/enums/sql.enums';
import { DemandGenerationService } from '../../demand-generation/services/demand-generation.service';
import { Sql } from '../../demand-generation/models/sql.model';
import { OuvsService } from '../../discovery/services/ouvs.service';
import { GraphService } from '../../graph-integration/services/graph.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { SqlAppointmentEvent } from '../models/sql-appointment-event.model';
import { SqlCita } from '../models/sql-cita.model';
import { SqlsService } from './sqls.service';

const SQL_ID = 'sql-1';
const LEAD_ID = 'lead-from-chain';
const EJECUTIVO_ID = 'ejec-1';
const SOPORTE_ID = 'soporte-1';

const dto = {
  tipo: InteractionTipo.Llamada,
  canal: InteractionCanal.Telefono,
} as CreateInteractionDto;

function build(options?: {
  estado?: SqlEstado;
  comercialAsignadoId?: string | null;
}) {
  const registerSqlInteraction = jest.fn().mockResolvedValue({
    interaction_id: 'int-1',
    lead_id: LEAD_ID,
    sql_id: SQL_ID,
    etapa: 'SQL',
  });
  const listInteractions = jest.fn().mockResolvedValue([]);
  const sql = {
    sqlId: SQL_ID,
    estado: options?.estado ?? SqlEstado.Asignado,
    comercialAsignadoId:
      options && 'comercialAsignadoId' in options
        ? options.comercialAsignadoId
        : EJECUTIVO_ID,
    mql: { leadId: LEAD_ID, estado: 'ConvertidoSQL' },
  };

  const service = new SqlsService(
    {} as Sequelize,
    { findByPk: jest.fn().mockResolvedValue(sql) } as unknown as typeof Sql,
    {} as typeof SqlCita,
    { create: jest.fn() } as unknown as typeof SqlAppointmentEvent,
    {
      registerSqlInteraction,
      listInteractions,
    } as unknown as DemandGenerationService,
    {} as UsersService,
    {} as WorkflowEngineService,
    {} as OuvsService,
    {} as GraphService,
  );

  return { service, registerSqlInteraction, listInteractions, sql };
}

describe('SqlsService SQL interactions', () => {
  it('persists the lead derived from the SQL chain, not a client lead id', async () => {
    const { service, registerSqlInteraction, sql } = build();

    await service.registerInteraction(SQL_ID, dto, SOPORTE_ID, 'SoporteComercial');

    expect(registerSqlInteraction).toHaveBeenCalledWith(
      LEAD_ID,
      SQL_ID,
      dto,
      SOPORTE_ID,
    );
    expect(sql.mql.estado).toBe('ConvertidoSQL');
  });

  it('rejects an Ejecutivo who is not comercial_asignado_id', async () => {
    const { service, registerSqlInteraction } = build();

    await expect(
      service.registerInteraction(SQL_ID, dto, 'otro-ejec', 'EjecutivoComercial'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(registerSqlInteraction).not.toHaveBeenCalled();
  });

  it('rejects registration when the SQL is ConvertidoOUV', async () => {
    const { service, registerSqlInteraction } = build({
      estado: SqlEstado.ConvertidoOUV,
    });

    await expect(
      service.registerInteraction(SQL_ID, dto, SOPORTE_ID, 'SoporteComercial'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(registerSqlInteraction).not.toHaveBeenCalled();
  });

  it('rejects registration when the SQL is EnGestion', async () => {
    const { service, registerSqlInteraction } = build({
      estado: SqlEstado.EnGestion,
    });

    await expect(
      service.registerInteraction(SQL_ID, dto, EJECUTIVO_ID, 'EjecutivoComercial'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(registerSqlInteraction).not.toHaveBeenCalled();
  });

  it('lists interactions of the derived lead for an authorized viewer', async () => {
    const { service, listInteractions } = build();

    await service.listInteractions(SQL_ID, EJECUTIVO_ID, 'EjecutivoComercial');

    expect(listInteractions).toHaveBeenCalledWith(LEAD_ID, EJECUTIVO_ID);
  });

  it('returns 403 when an Ejecutivo lists a SQL assigned to someone else', async () => {
    const { service, listInteractions } = build();

    await expect(
      service.listInteractions(SQL_ID, 'otro-ejec', 'EjecutivoComercial'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(listInteractions).not.toHaveBeenCalled();
  });
});
