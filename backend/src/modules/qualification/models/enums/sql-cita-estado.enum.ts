export enum SqlCitaEstado {
  Agendada = 'Agendada',
  Reagendada = 'Reagendada',
  Realizada = 'Realizada',
  Cancelada = 'Cancelada',
  NoAsistio = 'NoAsistio',
}

export const SQL_CITA_OPEN_ESTADOS = [
  SqlCitaEstado.Agendada,
  SqlCitaEstado.Reagendada,
] as const;

export const SQL_CITA_CLOSED_ESTADOS = [
  SqlCitaEstado.Realizada,
  SqlCitaEstado.NoAsistio,
  SqlCitaEstado.Cancelada,
] as const;

export function isOpenCitaEstado(
  estado?: string | null,
): estado is (typeof SQL_CITA_OPEN_ESTADOS)[number] {
  return (
    estado !== SqlCitaEstado.Realizada &&
    estado !== SqlCitaEstado.NoAsistio &&
    estado !== SqlCitaEstado.Cancelada
  );
}
