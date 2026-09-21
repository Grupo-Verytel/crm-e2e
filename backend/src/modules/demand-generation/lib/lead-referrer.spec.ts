import { CanalOrigen } from '../models/enums/lead.enums';
import { isReferidoCanal, resolveReferrerName } from './lead-referrer';

describe('lead-referrer name', () => {
  it('stores a trimmed name only when canal_origen is REFERIDO', () => {
    expect(isReferidoCanal(CanalOrigen.Referido)).toBe(true);
    expect(isReferidoCanal(CanalOrigen.BTL)).toBe(false);
    expect(resolveReferrerName(CanalOrigen.Referido, '  Ana Pérez  ')).toBe(
      'Ana Pérez',
    );
    expect(resolveReferrerName(CanalOrigen.Referido, '   ')).toBeNull();
    expect(resolveReferrerName(CanalOrigen.Referido, null)).toBeNull();
    expect(resolveReferrerName(CanalOrigen.BTL, 'Ana Pérez')).toBeNull();
  });
});
