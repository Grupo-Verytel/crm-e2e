import { canReadAllOuvs } from './ouv-access';

describe('canReadAllOuvs', () => {
  it('allows follow-up roles with Opportunity read to list every OUV', () => {
    expect(canReadAllOuvs('SoporteComercial')).toBe(true);
    expect(canReadAllOuvs('Admin')).toBe(true);
    expect(canReadAllOuvs('DirectorMercadeo')).toBe(true);
    expect(canReadAllOuvs('Director Mercadeo')).toBe(true);
    expect(canReadAllOuvs('GestorMercadeo')).toBe(true);
    expect(canReadAllOuvs('Preventa')).toBe(true);
    expect(canReadAllOuvs('Pricing')).toBe(true);
    expect(canReadAllOuvs('Gerente Comercial')).toBe(true);
    expect(canReadAllOuvs('GerenteComercial')).toBe(true);
  });

  it('scopes EjecutivoComercial to own pipeline', () => {
    expect(canReadAllOuvs('EjecutivoComercial')).toBe(false);
    expect(canReadAllOuvs('Ejecutivo Comercial')).toBe(false);
  });
});
