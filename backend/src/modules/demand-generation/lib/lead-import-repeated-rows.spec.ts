import {
  assertConsistentRepeatedCompanies,
  groupLeadImportRowsByCompany,
} from './lead-import-repeated-rows';

const company = {
  origen: 'Web',
  canal_origen: 'CAMPANA_DIGITAL',
  segmento: 'Gobierno',
  subsegmento: '',
  city: 'Bogotá, D.C. (Bogotá, D.C.)',
  account_name: 'Acme S.A.S.',
  tax_id: '900.123.456',
};

function row(
  rowNumber: number,
  overrides: Record<string, string> = {},
): { rowNumber: number; values: Record<string, string> } {
  return {
    rowNumber,
    values: {
      ...company,
      contacto_nombre: 'Ana Pérez',
      cargo: 'Directora',
      email: 'ana@acme.com',
      telefono: '3001112233',
      ...overrides,
    },
  };
}

describe('repeated company rows in lead import', () => {
  it('allows the same empresa and NIT when each row has a different contact and the same company fields', () => {
    expect(() =>
      assertConsistentRepeatedCompanies([
        row(2),
        row(3, {
          contacto_nombre: 'Luis Gómez',
          cargo: 'Gerente',
          email: 'luis@acme.com',
          telefono: '3014445566',
        }),
      ]),
    ).not.toThrow();
  });

  it('rejects a repeated empresa and NIT when origen, canal, segmento, subsegmento or city differ', () => {
    expect(() =>
      assertConsistentRepeatedCompanies([
        row(2),
        row(5, {
          origen: 'Email',
          canal_origen: 'EVENTOS',
          segmento: 'B2B',
          subsegmento: 'Manufactura',
          city: 'Medellín (Antioquia)',
          contacto_nombre: 'Luis Gómez',
          cargo: 'Gerente',
          email: 'luis@acme.com',
          telefono: '3014445566',
        }),
      ]),
    ).toThrow(/origen debe ser igual/);
  });

  it('rejects the same email even when the contact name differs', () => {
    expect(() =>
      assertConsistentRepeatedCompanies([
        row(2, { email: 'ana@acme.com', contacto_nombre: 'Ana Pérez' }),
        row(3, {
          email: 'ANA@acme.com',
          contacto_nombre: 'Ana P.',
          cargo: 'Gerente',
          telefono: '3010000000',
        }),
      ]),
    ).toThrow(/repite el email/);
  });

  it('rejects a repeated contact for the same empresa and NIT', () => {
    expect(() =>
      assertConsistentRepeatedCompanies([
        row(2, { telefono: '300 111 2233' }),
        row(4, { telefono: '300-111-2233', email: 'Ana@acme.com' }),
      ]),
    ).toThrow(/repite el mismo contacto/);
  });

  it('does not compare rows that belong to different companies', () => {
    expect(() =>
      assertConsistentRepeatedCompanies([
        row(2, { origen: 'Web' }),
        row(3, {
          account_name: 'Otra empresa',
          tax_id: '800999888',
          origen: 'Email',
          contacto_nombre: 'Ana Pérez',
          email: 'ana@acme.com',
        }),
      ]),
    ).not.toThrow();
  });

  it('groups repeated empresa and NIT into one company and keeps other companies apart', () => {
    const groups = groupLeadImportRowsByCompany([
      row(2, { contacto_nombre: 'Ana Pérez', email: 'ana@acme.com' }),
      row(3, {
        account_name: 'Otra empresa',
        tax_id: '800111222',
        contacto_nombre: 'Luis Gómez',
        email: 'luis@otra.com',
      }),
      row(4, {
        contacto_nombre: 'Gloria Peña',
        email: 'gloria@acme.com',
        telefono: '3014445566',
      }),
    ]);

    expect(groups.map((group) => group.map((item) => item.rowNumber))).toEqual([
      [2, 4],
      [3],
    ]);
  });

  it('treats Empresa (NIT) and a separate NIT column as the same company', () => {
    expect(() =>
      assertConsistentRepeatedCompanies([
        row(2, {
          account_name: 'Acme S.A.S. (900123456)',
          tax_id: '',
          contacto_nombre: 'Ana Pérez',
          email: 'ana@acme.com',
        }),
        row(3, {
          empresa: 'Acme S.A.S.',
          account_name: '',
          nit: '900-123-456',
          tax_id: '',
          contacto_nombre: 'Luis Gómez',
          cargo: 'Gerente',
          email: 'luis@acme.com',
          telefono: '3014445566',
          origen: 'Referido',
        }),
      ]),
    ).toThrow(/origen debe ser igual/);
  });
});
