import type { SqlDetail } from '../api/sqls-api';

const AGENCY_CANAL = 'GENERACION_DEMANDA_AGENCIA';

export function sqlLeadName(lead: SqlDetail['lead']): string {
  const name = typeof lead.name === 'string' ? lead.name.trim() : '';
  return name || String(lead.empresa_nombre ?? '—');
}

export function isAgencyLead(lead: SqlDetail['lead']): boolean {
  return lead.canal_origen === AGENCY_CANAL;
}

/** Director captured fecha/contacto on MQL approve; Soporte assigns commercial and creates sql_citas. */
export function needsAgencyCitaGeneration(sql: SqlDetail): boolean {
  if (sql.cita) {
    return false;
  }
  if (!isAgencyLead(sql.lead)) {
    return false;
  }
  return Boolean(sql.lead.cita_agendada || sql.lead.fecha_cita);
}

export function splitCitaDateTime(iso: string | null | undefined): {
  fecha: string;
  hora: string;
} | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    fecha: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    hora: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}
