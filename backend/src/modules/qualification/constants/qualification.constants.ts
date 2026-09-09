export const QUALIFICATION_ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SQL_NOT_PENDING: 'SQL_NOT_PENDING',
  SQL_NOT_ASSIGNED: 'SQL_NOT_ASSIGNED',
  CITA_ALREADY_EXISTS: 'CITA_ALREADY_EXISTS',
  CITA_NOT_FOUND: 'CITA_NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  TEAMS_MEETING_FAILED: 'TEAMS_MEETING_FAILED',
} as const;

/** Role names matching auth seeder Role.name. */
export const QUALIFICATION_ROLES = {
  SOPORTE_COMERCIAL: 'SoporteComercial',
  EJECUTIVO_COMERCIAL: 'EjecutivoComercial',
  DIRECTOR_MERCADEO: 'DirectorMercadeo',
} as const;

function compactRoleName(roleName: string): string {
  return roleName.replace(/[\s_-]/g, '').toLowerCase();
}

/** Compare Role.name ignoring spaces/underscores/hyphens and case. */
export function isQualificationRole(
  roleName: string | undefined,
  ...canonical: string[]
): boolean {
  if (!roleName) {
    return false;
  }
  const compact = compactRoleName(roleName);
  return canonical.some((name) => compactRoleName(name) === compact);
}
