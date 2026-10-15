// Catálogos de uniones temporales y aliados
// (`api/v1/offer-closing/joint-ventures` y `.../partners`).
//
// Se asignan como empresa ejecutora en el expediente de la venta ganada.
// Leer: quien lee el expediente. Crear: solo SoporteComercial.
import { apiRequest } from '../../../lib/api/http-client';

export type EmpresaExternaKind = 'UT' | 'Aliado';

export type EmpresaExterna = {
  id: string;
  /** `base-DV`. */
  nit: string;
  nombre: string;
  active: boolean;
};

const RUTA: Record<EmpresaExternaKind, string> = {
  UT: '/offer-closing/joint-ventures',
  Aliado: '/offer-closing/partners',
};

/** Subject CASL de cada catálogo, para mostrar u ocultar el botón de crear. */
export const EMPRESA_EXTERNA_SUBJECT: Record<EmpresaExternaKind, string> = {
  UT: 'JointVenture',
  Aliado: 'Partner',
};

export async function listEmpresasExternas(
  kind: EmpresaExternaKind,
): Promise<EmpresaExterna[]> {
  const response = await apiRequest<{ items: EmpresaExterna[] }>(RUTA[kind]);
  return response.items;
}

export async function createEmpresaExterna(
  kind: EmpresaExternaKind,
  input: { nit: string; nombre: string },
): Promise<EmpresaExterna> {
  return apiRequest<EmpresaExterna>(RUTA[kind], {
    method: 'POST',
    body: input,
  });
}
