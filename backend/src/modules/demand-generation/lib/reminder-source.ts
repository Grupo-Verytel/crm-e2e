/**
 * `sqls` has no consecutivo column. The detail page already shows this accent
 * (`SQL-` + the first 6 hex digits of `sql_id`). The bell uses the same label.
 */
export function sqlSourceLabel(sqlId: string): string {
  return `SQL-${sqlId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export function ouvSourceLabel(consecutivo: string, titulo: string): string {
  return [consecutivo.trim(), titulo.trim()].filter(Boolean).join(' — ');
}
