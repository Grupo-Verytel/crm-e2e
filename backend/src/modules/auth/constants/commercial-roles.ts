import { createRequire } from 'node:module';

const nodeRequire = createRequire(__filename);
const names = nodeRequire('./commercial-role-names.js') as {
  GERENTE_COMERCIAL_ROLE_NAME: string;
  EJECUTIVO_COMERCIAL_ROLE_NAME: string;
  ASSIGNABLE_COMMERCIAL_ROLE_NAMES: readonly string[];
};

export const GERENTE_COMERCIAL_ROLE_NAME = names.GERENTE_COMERCIAL_ROLE_NAME;
export const EJECUTIVO_COMERCIAL_ROLE_NAME =
  names.EJECUTIVO_COMERCIAL_ROLE_NAME;
export const ASSIGNABLE_COMMERCIAL_ROLE_NAMES =
  names.ASSIGNABLE_COMMERCIAL_ROLE_NAMES;

function compactRoleName(roleName: string): string {
  return roleName.replace(/[\s_-]/g, '').toLowerCase();
}

export function isGerenteComercialRole(
  roleName: string | undefined | null,
): boolean {
  return (
    !!roleName &&
    compactRoleName(roleName) === compactRoleName(GERENTE_COMERCIAL_ROLE_NAME)
  );
}

export function isAssignableCommercialRole(
  roleName: string | undefined | null,
): boolean {
  if (!roleName) {
    return false;
  }
  const compact = compactRoleName(roleName);
  return ASSIGNABLE_COMMERCIAL_ROLE_NAMES.some(
    (name) => compactRoleName(name) === compact,
  );
}

export type OuvBoardDefault = 'own' | 'all';

/** Q1: only Gerente Comercial enters `/opportunities` filtered to themselves. */
export function ouvBoardDefault(
  roleName: string | undefined | null,
): OuvBoardDefault {
  return isGerenteComercialRole(roleName) ? 'own' : 'all';
}

/** Same roles that may open a direct OUV they will own. */
export function canCreateDirectOuv(
  roleName: string | undefined | null,
): boolean {
  return isAssignableCommercialRole(roleName);
}
