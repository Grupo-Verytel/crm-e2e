import { readFileSync } from 'fs';
import { join } from 'path';

describe('Audit module architecture', () => {
  it('EARS-AUDIT-11: AuditWriterService is not exported from AuditModule', () => {
    const source = readFileSync(join(__dirname, 'audit.module.ts'), 'utf8');

    expect(source).toContain('AuditWriterService');
    expect(source).not.toMatch(/exports:\s*\[[^\]]*AuditWriterService/s);
  });
});
