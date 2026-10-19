import { AssignedOuvsService } from './assigned-ouvs.service';

const ACTOR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NOW = new Date('2026-10-17T15:00:00.000Z');

describe('AssignedOuvsService', () => {
  function createService(yellowDays: unknown = '2') {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return [{ total: 4 }];
      }
      return [
        {
          ouv_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          consecutivo: 'OUV-0002',
          titulo: 'Norte',
          empresa_nombre: 'Acme',
          zona_actual: 'UNIVERSO',
          comercial_id: ACTOR,
          comercial_nombre: 'Ana',
          next_reminder_at: '2026-10-16T15:00:00.000Z',
          follow_up_status: 'RED',
        },
      ];
    });
    const service = new AssignedOuvsService(
      { sequelize: { query } } as never,
      { get: jest.fn().mockReturnValue(yellowDays) } as never,
    );
    return { service, query };
  }

  function calls(query: jest.Mock) {
    const list = query.mock.calls.find((call) =>
      String(call[0]).includes('LIMIT'),
    );
    const count = query.mock.calls.find((call) =>
      String(call[0]).includes('COUNT(*)'),
    );
    return {
      listSql: String(list?.[0]),
      countSql: String(count?.[0]),
      replacements: (list?.[1] as { replacements: Record<string, unknown> })
        .replacements,
    };
  }

  it('limits an Ejecutivo to their own OUVs and ignores comercial_id', async () => {
    const { service, query } = createService();
    await service.list(
      { page: 1, limit: 20, comercial_id: OTHER },
      ACTOR,
      'EjecutivoComercial',
      NOW,
    );
    const { listSql, replacements } = calls(query);
    expect(listSql).toContain('o.comercial_id = :comercialId');
    expect(replacements.comercialId).toBe(ACTOR);
    expect(listSql).not.toContain(OTHER);
  });

  it('lets SoporteComercial see every in-progress OUV and filter by comercial', async () => {
    const all = createService();
    await all.service.list(
      { page: 1, limit: 20 },
      ACTOR,
      'SoporteComercial',
      NOW,
    );
    expect(calls(all.query).listSql).not.toContain('o.comercial_id =');

    const filtered = createService();
    await filtered.service.list(
      { page: 1, limit: 20, comercial_id: OTHER },
      ACTOR,
      'SoporteComercial',
      NOW,
    );
    expect(calls(filtered.query).replacements.comercialId).toBe(OTHER);
  });

  it('filters follow_up_status in the page and in the count, and keeps the default order', async () => {
    const { service, query } = createService();
    const result = await service.list(
      { page: 2, limit: 1, follow_up_status: ['GREEN', 'NONE'], search: 'Acme' },
      ACTOR,
      'SoporteComercial',
      NOW,
    );
    const { listSql, countSql, replacements } = calls(query);
    expect(listSql).toContain("o.resultado = 'EnCurso'");
    expect(listSql).toContain('MIN(r.event_at)');
    expect(listSql).toContain('oi.deleted_at IS NULL');
    expect(listSql).toContain("r.status <> 'Cancelado'");
    expect(listSql).toContain('follow_up_status IN (:statuses)');
    expect(countSql).toContain('follow_up_status IN (:statuses)');
    expect(countSql).not.toContain('LIMIT');
    expect(replacements.statuses).toEqual(['GREEN', 'NONE']);
    expect(replacements.search).toBe('%Acme%');
    expect(listSql).toContain('o.consecutivo LIKE');
    expect(listSql).toContain('o.empresa_nombre LIKE');
    expect(listSql).toContain('o.titulo LIKE');
    expect(listSql).toContain("ESCAPE '\\\\'");
    expect(listSql).toContain("WHEN 'RED' THEN 1");
    expect(listSql).toContain("WHEN 'YELLOW' THEN 2");
    expect(listSql).toContain("WHEN 'GREEN' THEN 3");
    expect(listSql).toContain('next_reminder_at ASC');
    expect(listSql).toContain('consecutivo ASC');
    expect(listSql).toContain('LIMIT 1 OFFSET 1');
    expect(result.total).toBe(4);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(1);
    expect(result.items[0].follow_up_status).toBe('RED');
    expect(result.items[0].next_reminder_at?.toISOString()).toBe(
      '2026-10-16T15:00:00.000Z',
    );
  });

  it('refuses to start when FOLLOW_UP_YELLOW_DAYS is not an integer >= 0', () => {
    const { service } = createService('-1');
    expect(() => service.onModuleInit()).toThrow(/integer >= 0/);
  });
});
