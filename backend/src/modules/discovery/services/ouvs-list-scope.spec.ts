import { ASSIGNABLE_COMMERCIAL_ROLE_NAMES } from '../../auth/constants/commercial-roles';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { OuvsController } from '../controllers/ouvs.controller';
import { OuvsService } from './ouvs.service';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function user(roleName: string, userId = ACTOR): AuthenticatedUser {
  return { userId, roleName, permissions: [] };
}

describe('GET /discovery/ouvs scope', () => {
  function controller() {
    const listarPorComercial = jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    const presentPage = jest.fn().mockResolvedValue([]);
    const api = new OuvsController(
      { listarPorComercial, presentPage } as unknown as OuvsService,
      {} as never,
      {} as never,
    );
    return { api, listarPorComercial };
  }

  it('REQ-08: EjecutivoComercial ignores all and a foreign comercial_id', async () => {
    const { api, listarPorComercial } = controller();
    await api.listar(
      { all: true, comercial_id: OTHER },
      user('EjecutivoComercial'),
    );
    expect(listarPorComercial).toHaveBeenCalledWith(
      ACTOR,
      expect.objectContaining({ all: false, comercial_id: OTHER }),
    );
  });

  it('REQ-03: SoporteComercial keeps all and the commercial filter', async () => {
    const { api, listarPorComercial } = controller();
    await api.listar(
      { all: true, comercial_id: OTHER },
      user('SoporteComercial'),
    );
    expect(listarPorComercial).toHaveBeenCalledWith(
      ACTOR,
      expect.objectContaining({ all: true, comercial_id: OTHER }),
    );
  });

  it('REQ-05: Gerente Comercial can list all or one commercial', async () => {
    const { api, listarPorComercial } = controller();
    await api.listar({ all: true }, user('Gerente Comercial'));
    await api.listar(
      { all: true, comercial_id: ACTOR },
      user('Gerente Comercial'),
    );
    await api.listar(
      { all: true, comercial_id: OTHER },
      user('Gerente Comercial'),
    );

    expect(listarPorComercial).toHaveBeenNthCalledWith(
      1,
      ACTOR,
      expect.objectContaining({ all: true }),
    );
    expect(listarPorComercial).toHaveBeenNthCalledWith(
      2,
      ACTOR,
      expect.objectContaining({ all: true, comercial_id: ACTOR }),
    );
    expect(listarPorComercial).toHaveBeenNthCalledWith(
      3,
      ACTOR,
      expect.objectContaining({ all: true, comercial_id: OTHER }),
    );
  });
});

function ownerId(findAndCountAll: jest.Mock): string | undefined {
  const calls = findAndCountAll.mock.calls as Array<
    [{ where: { comercialId?: string } }]
  >;
  return calls[0][0].where.comercialId;
}

describe('OuvsService list filters', () => {
  function service(usersService: Record<string, unknown> = {}) {
    const findAndCountAll = jest.fn().mockResolvedValue({ rows: [], count: 0 });
    const slots = Array.from({ length: 15 }, () => ({}));
    slots[1] = { findAndCountAll };
    slots[7] = usersService;
    const ouvService = new OuvsService(...(slots as never[]));
    return { ouvService, findAndCountAll };
  }

  it('without all, scopes to the actor and ignores comercial_id', async () => {
    const { ouvService, findAndCountAll } = service();
    await ouvService.listarPorComercial(ACTOR, {
      all: false,
      comercial_id: OTHER,
    });
    expect(ownerId(findAndCountAll)).toBe(ACTOR);
  });

  it('with all and no comercial_id, does not filter the owner', async () => {
    const { ouvService, findAndCountAll } = service();
    await ouvService.listarPorComercial(ACTOR, { all: true });
    expect(ownerId(findAndCountAll)).toBeUndefined();
  });

  it('with all and comercial_id, filters that commercial', async () => {
    const { ouvService, findAndCountAll } = service();
    await ouvService.listarPorComercial(ACTOR, {
      all: true,
      comercial_id: OTHER,
    });
    expect(ownerId(findAndCountAll)).toBe(OTHER);
  });

  it('REQ-06: the commercial catalog includes both roles and their names', async () => {
    const findActiveByRoleNames = jest.fn().mockResolvedValue([
      {
        user_id: 'ejec-1',
        full_name: 'Ana',
        role_name: 'EjecutivoComercial',
      },
      {
        user_id: 'gerente-1',
        full_name: 'Miguel',
        role_name: 'Gerente Comercial',
      },
    ]);
    const { ouvService } = service({ findActiveByRoleNames });

    const rows = await ouvService.listEjecutivosComerciales();

    expect(findActiveByRoleNames).toHaveBeenCalledWith(
      ASSIGNABLE_COMMERCIAL_ROLE_NAMES,
    );
    expect(rows).toEqual([
      {
        user_id: 'ejec-1',
        full_name: 'Ana',
        role_name: 'EjecutivoComercial',
      },
      {
        user_id: 'gerente-1',
        full_name: 'Miguel',
        role_name: 'Gerente Comercial',
      },
    ]);
  });

  it('REQ-07: Admin can reassign an OUV to an active Gerente Comercial', async () => {
    const isActiveWithAnyRole = jest.fn().mockResolvedValue(true);
    const update = jest.fn().mockResolvedValue(undefined);
    const ouv = {
      comercialId: ACTOR,
      resultado: 'EnCurso',
      segmentId: null,
      subsegmentId: null,
      update,
    };
    const findByPk = jest.fn().mockResolvedValue(ouv);
    const slots = Array.from({ length: 15 }, () => ({}));
    slots[0] = {
      transaction: async (work: (tx: object) => Promise<unknown>) =>
        work({ LOCK: { UPDATE: 'UPDATE' } }),
    };
    slots[1] = { findByPk };
    slots[7] = { isActiveWithAnyRole };
    const ouvService = new OuvsService(...(slots as never[]));

    await ouvService.actualizarMetadatos(
      'ouv-1',
      { comercial_id: OTHER },
      ACTOR,
      'Admin',
    );

    expect(isActiveWithAnyRole).toHaveBeenCalledWith(
      OTHER,
      ASSIGNABLE_COMMERCIAL_ROLE_NAMES,
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ comercialId: OTHER }),
      expect.anything(),
    );
  });
});
