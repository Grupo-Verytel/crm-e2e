import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { FORBIDDEN_PROPERTY_NAMES } from './validation/forbidden-properties';

const MODULE_ROOT = __dirname;
const MIGRATION = join(
  __dirname,
  '../../../database/migrations/20260902100000-create-mep-integration-tables.js',
);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (full.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = walk(MODULE_ROOT).filter(
  (file) => !file.endsWith('.spec.ts'),
);

describe('arquitectura del módulo de integración — §2.3 / §7.4', () => {
  it('TS-LEAN-03 / INV-25: ninguna columna del esquema lleva un nombre prohibido', () => {
    const ddl = readFileSync(MIGRATION, 'utf8');

    const createStatements = ddl
      .slice(ddl.indexOf('CREATE TABLE'))
      .toLowerCase();

    for (const forbidden of FORBIDDEN_PROPERTY_NAMES) {
      // Se compara con límites de identificador, no por subcadena:
      // `delivered_interaction_type` es una columna legítima del §8 que
      // contiene a `interaction_type` como sufijo.
      const asColumnName = new RegExp(
        `(?<![a-z0-9_])${forbidden}(?![a-z0-9_])`,
      );
      expect({ forbidden, found: asColumnName.test(createStatements) }).toEqual(
        {
          forbidden,
          found: false,
        },
      );
    }
  });

  it('§8: `delivered_interaction_type` sí es una columna legítima del contrato', () => {
    const ddl = readFileSync(MIGRATION, 'utf8');

    expect(ddl).toContain('delivered_interaction_type  VARCHAR(128) NULL');
  });

  it('§2.3: el esquema no modela Events, Snapshots, Cuts, Excel ni retries', () => {
    const ddl = readFileSync(MIGRATION, 'utf8').toLowerCase();
    const createStatements = ddl.slice(ddl.indexOf('create table'));

    for (const concept of [
      'snapshot',
      'excel',
      'process_evidence',
      'evidence_url',
      'archetype_lane',
      'delivery_attempt',
    ]) {
      expect(createStatements).not.toContain(concept);
    }
  });

  it('INV-06 / INV-19: ningún modelo ni presentador declara `interaction_type`', () => {
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      // El nombre solo puede aparecer dentro de la lista negra de §7.4 y de
      // los comentarios que la explican, nunca como campo del contrato.
      const declaresField = /^\s*(declare\s+)?interaction_?type/im.test(source);
      expect({ file, declaresField }).toEqual({ file, declaresField: false });
    }
  });

  it('P-02: el módulo no invoca ningún endpoint de MEP-LEAN (pull, no push)', () => {
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');

      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/\baxios\b/);
      expect(source).not.toMatch(/HttpService/);
      expect(source).not.toMatch(/require\(['"]https?['"]\)/);
    }
  });

  it('INV-11 / TS-OUV-04: no existe ninguna operación de escritura sobre la OUV', () => {
    const opportunityFiles = sourceFiles.filter((file) =>
      file.includes('opportunit'),
    );

    expect(opportunityFiles.length).toBeGreaterThan(0);

    for (const file of opportunityFiles) {
      const source = readFileSync(file, 'utf8');

      expect(source).not.toMatch(/@(Post|Put|Patch|Delete)\(/);
      expect(source).not.toMatch(/\.(update|create|destroy|upsert)\(/);
    }
  });

  it('TS-CLS-04 / INV-19: la clasificación no se deriva de `requested_services[]`', () => {
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');

      // No puede existir ninguna asignación a `deliveredInteractionType` /
      // `delivered_interaction_type` que lea de los servicios solicitados.
      const derivation =
        /delivered_?[Ii]nteraction_?[Tt]ype\s*[:=][^;\n]*requested_?[Ss]ervices/.test(
          source,
        );
      expect({ file, derivation }).toEqual({ file, derivation: false });
    }
  });

  it('P-06 / INV-33: las tablas append-only están protegidas en BD por triggers', () => {
    const ddl = readFileSync(MIGRATION, 'utf8');

    // La migración genera los triggers en bucle sobre esta misma lista.
    expect(ddl).toContain("'processing_receipt',");
    expect(ddl).toContain("'mep_response_version',");
    expect(ddl).toContain("'mep_audit_log',");
    expect(ddl).toContain('_no_update');
    expect(ddl).toContain('_no_delete');

    expect(ddl).toContain('BEFORE UPDATE');
    expect(ddl).toContain('BEFORE DELETE');
    expect(ddl).toContain('is append-only');
  });

  it('P-07 / INV-07: un trigger de BD impide alterar `source_content`', () => {
    const ddl = readFileSync(MIGRATION, 'utf8');

    expect(ddl).toContain(
      'trg_commercial_interaction_source_content_immutable',
    );
    expect(ddl).toContain('source_content is immutable');
  });
});
