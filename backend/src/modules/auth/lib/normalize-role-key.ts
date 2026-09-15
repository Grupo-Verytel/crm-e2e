/** Compare role names ignoring spaces, hyphens and underscores. */
export function normalizeRoleKey(name: string): string {
  return name.replace(/[\s_-]/g, '').toLowerCase();
}
