import { canReadAllOuvs } from './ouv-access';

describe('canReadAllOuvs', () => {
  it('allows support, admin, marketing and presales/pricing follow-up', () => {
    expect(canReadAllOuvs('SoporteComercial')).toBe(true);
    expect(canReadAllOuvs('Admin')).toBe(true);
    expect(canReadAllOuvs('DirectorMercadeo')).toBe(true);
    expect(canReadAllOuvs('Director Mercadeo')).toBe(true);
    expect(canReadAllOuvs('GestorMercadeo')).toBe(true);
    expect(canReadAllOuvs('Preventa')).toBe(true);
    expect(canReadAllOuvs('Pricing')).toBe(true);
  });

  it('scopes EjecutivoComercial to own pipeline', () => {
    expect(canReadAllOuvs('EjecutivoComercial')).toBe(false);
    expect(canReadAllOuvs('Ejecutivo Comercial')).toBe(false);
  });
});
