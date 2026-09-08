/** Compare Role.name values ignoring spaces, underscores, hyphens and case. */
export function compactRoleName(roleName: string): string {
  return roleName.replace(/[\s_-]/g, '').toLowerCase();
}

export function isRoleName(
  roleName: string | undefined,
  ...canonical: string[]
): boolean {
  if (!roleName) {
    return false;
  }
  const compact = compactRoleName(roleName);
  return canonical.some((name) => compactRoleName(name) === compact);
}
