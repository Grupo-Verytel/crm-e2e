import { AuditLog } from './audit-log.model';

describe('AuditLog model', () => {
  it('EARS-AUDIT-10: prevents update and delete (append-only)', () => {
    expect(() => AuditLog.preventMutation()).toThrow(
      'audit_log is append-only',
    );
  });
});
