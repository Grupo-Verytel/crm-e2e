export type LeadImportRowSnapshot = {
  rowNumber: number;
  values: Record<string, string>;
};

const COMPANY_FIELDS = [
  { keys: ['origen'], label: 'origen' },
  { keys: ['canal_origen'], label: 'canal de origen' },
  { keys: ['segmento'], label: 'segmento' },
  { keys: ['subsegmento', 'industria'], label: 'subsegmento' },
  { keys: ['city', 'ciudad'], label: 'ciudad' },
] as const;

const MAX_ERRORS = 12;

function cell(values: Record<string, string>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = values[key];
    if (value?.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeLoose(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeNit(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function displayCell(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'vacío';
}

type AccountIdentity = {
  name: string;
  nit: string;
  nitLabel: string;
};

function accountIdentity(values: Record<string, string>): AccountIdentity {
  const raw = cell(values, ['account_name', 'empresa', 'empresa_nombre']);
  const nitColumn = cell(values, ['tax_id', 'nit']);
  const combined = raw.match(/^(.*) \(([^)]+)\)\s*$/);
  const labelTax = combined?.[2]?.replace(/\s/g, '') ?? '';
  const looksLikeTaxId = /^\d[\d.\-]{4,}$/.test(labelTax);
  const name = combined && looksLikeTaxId ? combined[1].trim() : raw;
  const nitSource =
    nitColumn || (looksLikeTaxId ? (combined?.[2] ?? '') : '');
  return {
    name,
    nit: normalizeNit(nitSource),
    nitLabel: nitSource.trim(),
  };
}

function companyGroupKey(identity: AccountIdentity): string {
  return `${normalizeLoose(identity.name)}\u0000${identity.nit}`;
}

function contactKey(values: Record<string, string>): string {
  return [
    normalizeLoose(cell(values, ['contacto_nombre'])),
    normalizeLoose(cell(values, ['cargo'])),
    cell(values, ['email']).toLowerCase(),
    normalizePhone(cell(values, ['telefono'])),
  ].join('\u0000');
}

function contactLabel(values: Record<string, string>): string {
  return [
    displayCell(cell(values, ['contacto_nombre'])),
    displayCell(cell(values, ['cargo'])),
    displayCell(cell(values, ['email'])),
    displayCell(cell(values, ['telefono'])),
  ].join(', ');
}

function companyLabel(identity: AccountIdentity): string {
  const nit = identity.nitLabel.trim() || (identity.nit ? identity.nit : '');
  return nit
    ? `"${identity.name}" (NIT ${nit})`
    : `"${identity.name}" (sin NIT)`;
}

function fieldMismatches(
  group: LeadImportRowSnapshot[],
  identity: AccountIdentity,
): string[] {
  const reference = group[0];
  const errors: string[] = [];

  for (const field of COMPANY_FIELDS) {
    const expected = normalizeLoose(cell(reference.values, field.keys));
    const offenders = group.filter(
      (row) => normalizeLoose(cell(row.values, field.keys)) !== expected,
    );
    if (offenders.length === 0) {
      continue;
    }

    const details = offenders
      .map(
        (row) =>
          `fila ${row.rowNumber} tiene "${displayCell(cell(row.values, field.keys))}"`,
      )
      .join('; ');
    errors.push(
      `Filas ${group.map((row) => row.rowNumber).join(', ')}: la empresa ${companyLabel(identity)} se repite, pero ${field.label} debe ser igual en todas. La fila ${reference.rowNumber} tiene "${displayCell(cell(reference.values, field.keys))}" y ${details}.`,
    );
  }

  return errors;
}

function duplicateContacts(
  group: LeadImportRowSnapshot[],
  identity: AccountIdentity,
): string[] {
  const byContact = new Map<string, LeadImportRowSnapshot[]>();
  const byEmail = new Map<string, LeadImportRowSnapshot[]>();

  for (const row of group) {
    const key = contactKey(row.values);
    const contactRows = byContact.get(key) ?? [];
    contactRows.push(row);
    byContact.set(key, contactRows);

    const email = cell(row.values, ['email']).toLowerCase();
    if (email) {
      const emailRows = byEmail.get(email) ?? [];
      emailRows.push(row);
      byEmail.set(email, emailRows);
    }
  }

  const errors: string[] = [];
  const coveredByFullContact = new Set<number>();

  for (const contactRows of byContact.values()) {
    if (contactRows.length < 2) {
      continue;
    }
    for (const row of contactRows) {
      coveredByFullContact.add(row.rowNumber);
    }
    errors.push(
      `Filas ${contactRows.map((row) => row.rowNumber).join(', ')}: la empresa ${companyLabel(identity)} repite el mismo contacto (${contactLabel(contactRows[0].values)}). Cada fila de esa empresa debe traer un contacto distinto en nombre, cargo, email y teléfono.`,
    );
  }

  for (const emailRows of byEmail.values()) {
    if (emailRows.length < 2) {
      continue;
    }
    if (emailRows.every((row) => coveredByFullContact.has(row.rowNumber))) {
      continue;
    }
    errors.push(
      `Filas ${emailRows.map((row) => row.rowNumber).join(', ')}: la empresa ${companyLabel(identity)} repite el email ${cell(emailRows[0].values, ['email'])}. Cada fila de esa empresa debe traer un email distinto.`,
    );
  }

  return errors;
}

/**
 * Rows that share Empresa + NIT may repeat. Their contact
 * (nombre, cargo, email, teléfono) must be unique, and origen, canal,
 * segmento, subsegmento and city must match across those rows.
 */
export function repeatedCompanyConsistencyErrors(
  rows: LeadImportRowSnapshot[],
): string[] {
  const groups = new Map<string, LeadImportRowSnapshot[]>();
  const identities = new Map<string, AccountIdentity>();

  for (const row of rows) {
    const identity = accountIdentity(row.values);
    if (!identity.name.trim()) {
      continue;
    }
    const key = companyGroupKey(identity);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
    if (!identities.has(key)) {
      identities.set(key, identity);
    }
  }

  const errors: string[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) {
      continue;
    }
    const identity = identities.get(key);
    if (!identity) {
      continue;
    }
    errors.push(...fieldMismatches(group, identity));
    errors.push(...duplicateContacts(group, identity));
  }

  if (errors.length <= MAX_ERRORS) {
    return errors;
  }

  return [
    ...errors.slice(0, MAX_ERRORS),
    `Hay ${errors.length - MAX_ERRORS} diferencias más. Corrige el archivo y vuelve a cargarlo.`,
  ];
}

export function assertConsistentRepeatedCompanies(
  rows: LeadImportRowSnapshot[],
): void {
  const errors = repeatedCompanyConsistencyErrors(rows);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}
