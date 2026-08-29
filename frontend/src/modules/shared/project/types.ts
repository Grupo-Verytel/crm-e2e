/** Shared project-handover types — consumed by offer-closing and implementation (mock layer). */

export type TipoVenta = 'Licitacion' | 'VentaDirecta';

export type ValidacionEstado = 'Pendiente' | 'Aprobado' | 'Rechazado';

export type ValidacionTipo = 'Tecnica' | 'Financiera';

export type EmpresaEjecutora = 'Frisson' | 'Verytel' | 'UT';

export type AlertaEstado = 'Pendiente' | 'Activa' | 'Resuelta';

export type AlertaRecord = {
  id: string;
  tipo: string;
  estado: AlertaEstado;
  descripcion: string;
  fecha: string;
};

export type DatosBaseProyecto = {
  ouvId: string;
  consecutivo: string;
  nombreProyecto: string;
  cliente: string;
  oportunidad: string;
  fechaInicio: string;
  fechaFin: string;
  valorFacturar: number;
  costoEstimado: number;
  recurrente: boolean;
  empresasEjecutoras: EmpresaEjecutora[];
  unionesTemporales: { nombre: string; participacionPct: number }[];
  directorProyectoId: string | null;
  directorProyectoNombre: string | null;
  tipoVenta: TipoVenta;
  centroCostos: string;
  ubv: string;
  participacion: string;
  participacionPct: number;
};

export type IndicadorBloque = {
  valor: string | null;
  estado: string;
  actualizadoEn: string | null;
  soloLectura?: boolean;
};

export type IndicadoresProyecto = {
  facturacion: IndicadorBloque;
  costos: IndicadorBloque;
  tiempo: IndicadorBloque;
  alcance: IndicadorBloque;
  documentacion: IndicadorBloque;
  ejecucion: IndicadorBloque;
};

export type CsatRecord = {
  valor: number | null;
  escala: number;
  fecha: string | null;
};

export type ValidacionRecord = {
  estado: ValidacionEstado;
  observacion: string;
  usuario: string | null;
  fecha: string | null;
  /** SharePoint document for Técnica / Financiera */
  sharepointUrl: string | null;
  sharepointNombre: string | null;
};

export type KickoffEstado = 'Programado' | 'Realizado' | 'Cancelado';

export type KickoffRecord = {
  sesionNombre: string;
  sesionFecha: string;
  enlace: string;
  estado: KickoffEstado;
  fechaRealizacion: string | null;
  aprobaciones: { id: string; label: string; completada: boolean }[];
  validadoTeams: boolean;
};

export type EnvioPmoEstado =
  | 'NoEnviado'
  | 'Pendiente'
  | 'Enviado'
  | 'Rechazado'
  | 'Error';

export type EnvioPmoRecord = {
  estado: EnvioPmoEstado;
  consecutivoControlProyectos: string | null;
  serConsecutivo: string | null;
  motivo: string | null;
  enviadoEn: string | null;
};

export type EstadoRevision = 'Pendiente' | 'EnRevision' | 'Aprobada';

export type VentaGanadaRecord = {
  ouvId: string;
  consecutivo: string;
  titulo: string;
  empresaNombre: string;
  vendedorNombre: string;
  estadoRevision: EstadoRevision;
  validaciones: Record<ValidacionTipo, ValidacionRecord>;
  datosBase: DatosBaseProyecto;
  kickoff: KickoffRecord;
  envioPmo: EnvioPmoRecord;
  indicadores: IndicadoresProyecto;
  csat: CsatRecord;
  alertas: AlertaRecord[];
  historialEstados: { estado: string; fecha: string; origen: string }[];
  createdAt: string;
  updatedAt: string;
};

export type ProyectoImplementacionRecord = VentaGanadaRecord & {
  serId: string;
};

export const VALIDACION_TIPOS: ValidacionTipo[] = ['Tecnica', 'Financiera'];

export const TIPO_VENTA_LABEL: Record<TipoVenta, string> = {
  Licitacion: 'Licitación',
  VentaDirecta: 'Venta directa',
};

export const VALIDACION_ESTADO_LABEL: Record<ValidacionEstado, string> = {
  Pendiente: 'Pendiente',
  Aprobado: 'Aprobado',
  Rechazado: 'Rechazado',
};
