// Expediente de venta ganada persistido en el backend
// (`api/v1/offer-closing/ouvs/:ouvId/won-sale`).
//
// Sustituye al almacenamiento en `localStorage`: el formulario de datos del
// proyecto y las validaciones de viabilidad los diligencian varias personas,
// así que tienen que verse iguales desde cualquier navegador.
import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type {
  AlertaRecord,
  CsatRecord,
  DatosBaseProyecto,
  EmpresaEjecutora,
  EnvioPmoEstado,
  EstadoRevision,
  IndicadoresProyecto,
  MiembroEjecutor,
  TipoVenta,
  ValidacionEstado,
  ValidacionRecord,
  ValidacionTipo,
  VentaGanadaRecord,
} from '../../shared/project/types';

type ValidacionDto = {
  wonSaleValidationId?: string;
  tipo: ValidacionTipo;
  estado: ValidacionEstado;
  observacion?: string | null;
  usuario?: string | null;
  fecha?: string | null;
  sharepointUrl?: string | null;
  sharepointNombre?: string | null;
};

type MiembroDto = {
  wonSaleMemberId?: string;
  refId: string;
  nombre: string;
  participacionPct: number;
  empresa?: EmpresaEjecutora | null;
};

type AlertaDto = {
  wonSaleAlertId?: string;
  refId: string;
  tipo: string;
  estado: AlertaRecord['estado'];
  descripcion: string;
  fecha?: string | null;
};

type HistorialDto = {
  wonSaleHistoryEntryId?: string;
  estado: string;
  fecha: string;
  origen: string;
};

export type WonSaleDto = {
  wonSaleId: string;
  ouvId: string;
  estadoRevision: EstadoRevision;
  nombreProyecto: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  valorFacturar: number;
  costoEstimado: number;
  recurrente: boolean;
  tipoVenta: TipoVenta;
  directorProyectoId: string | null;
  directorProyectoNombre: string | null;
  centroCostos: string | null;
  ubv: string | null;
  participacion: string | null;
  participacionPct: number;
  envioPmoEstado: EnvioPmoEstado;
  envioPmoConsecutivo: string | null;
  envioPmoSer: string | null;
  envioPmoMotivo: string | null;
  envioPmoEnviadoEn: string | null;
  indicadores: IndicadoresProyecto | null;
  csat: CsatRecord | null;
  validaciones: ValidacionDto[];
  miembros: MiembroDto[];
  alertas: AlertaDto[];
  historial: HistorialDto[];
  createdAt: string;
  updatedAt: string;
};

type SaveWonSalePayload = Omit<
  WonSaleDto,
  'wonSaleId' | 'ouvId' | 'createdAt' | 'updatedAt'
>;

const VALIDACION_TIPOS: ValidacionTipo[] = ['Tecnica', 'Financiera'];

function validacionVacia(): ValidacionRecord {
  return {
    estado: 'Pendiente',
    observacion: '',
    usuario: null,
    fecha: null,
    sharepointUrl: null,
    sharepointNombre: null,
  };
}

/** Los botones de empresa se encienden según las filas que existen. */
function empresasDe(miembros: MiembroEjecutor[]): EmpresaEjecutora[] {
  const empresas: EmpresaEjecutora[] = ['Frisson', 'Verytel', 'UT'];
  return empresas.filter((e) => miembros.some((m) => m.empresa === e));
}

/**
 * Vuelca el expediente del backend sobre el registro que la pantalla ya maneja.
 *
 * Se parte del registro base construido desde la OUV (consecutivo, título,
 * cliente…), porque esos campos son de la oportunidad y no del expediente.
 */
export function applyWonSale(
  base: VentaGanadaRecord,
  dto: WonSaleDto,
): VentaGanadaRecord {
  const miembros: MiembroEjecutor[] = dto.miembros.map((m) => ({
    id: m.refId,
    nombre: m.nombre,
    participacionPct: m.participacionPct,
    empresa: m.empresa ?? null,
  }));

  const validaciones = { ...base.validaciones };
  for (const tipo of VALIDACION_TIPOS) {
    const guardada = dto.validaciones.find((v) => v.tipo === tipo);
    validaciones[tipo] = guardada
      ? {
          estado: guardada.estado,
          observacion: guardada.observacion ?? '',
          usuario: guardada.usuario ?? null,
          fecha: guardada.fecha ?? null,
          sharepointUrl: guardada.sharepointUrl ?? null,
          sharepointNombre: guardada.sharepointNombre ?? null,
        }
      : validacionVacia();
  }

  const datosBase: DatosBaseProyecto = {
    ...base.datosBase,
    nombreProyecto: dto.nombreProyecto,
    fechaInicio: dto.fechaInicio ?? '',
    fechaFin: dto.fechaFin ?? '',
    valorFacturar: dto.valorFacturar,
    costoEstimado: dto.costoEstimado,
    recurrente: dto.recurrente,
    tipoVenta: dto.tipoVenta,
    directorProyectoId: dto.directorProyectoId,
    directorProyectoNombre: dto.directorProyectoNombre,
    centroCostos: dto.centroCostos ?? '',
    ubv: dto.ubv ?? '',
    participacion: dto.participacion ?? '',
    participacionPct: dto.participacionPct,
    empresasEjecutoras: empresasDe(miembros),
    unionesTemporales: miembros,
  };

  return {
    ...base,
    estadoRevision: dto.estadoRevision,
    validaciones,
    datosBase,
    envioPmo: {
      estado: dto.envioPmoEstado,
      consecutivoControlProyectos: dto.envioPmoConsecutivo,
      serConsecutivo: dto.envioPmoSer,
      motivo: dto.envioPmoMotivo,
      enviadoEn: dto.envioPmoEnviadoEn,
    },
    indicadores: dto.indicadores ?? base.indicadores,
    csat: dto.csat ?? base.csat,
    alertas: dto.alertas.map((a) => ({
      id: a.refId,
      tipo: a.tipo,
      estado: a.estado,
      descripcion: a.descripcion,
      fecha: a.fecha ?? '',
    })),
    historialEstados: dto.historial.map((h) => ({
      estado: h.estado,
      fecha: h.fecha,
      origen: h.origen,
    })),
    updatedAt: dto.updatedAt,
  };
}

/** `YYYY-MM-DD` o nada: el backend rechaza cualquier otro formato. */
function fechaSola(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function toPayload(record: VentaGanadaRecord): SaveWonSalePayload {
  const d = record.datosBase;
  return {
    estadoRevision: record.estadoRevision,
    nombreProyecto: d.nombreProyecto,
    fechaInicio: fechaSola(d.fechaInicio),
    fechaFin: fechaSola(d.fechaFin),
    valorFacturar: d.valorFacturar || 0,
    costoEstimado: d.costoEstimado || 0,
    recurrente: d.recurrente,
    tipoVenta: d.tipoVenta,
    directorProyectoId: d.directorProyectoId,
    directorProyectoNombre: d.directorProyectoNombre,
    centroCostos: d.centroCostos || null,
    ubv: d.ubv || null,
    participacion: d.participacion || null,
    participacionPct: d.participacionPct || 0,
    envioPmoEstado: record.envioPmo.estado,
    envioPmoConsecutivo: record.envioPmo.consecutivoControlProyectos,
    envioPmoSer: record.envioPmo.serConsecutivo,
    envioPmoMotivo: record.envioPmo.motivo,
    envioPmoEnviadoEn: record.envioPmo.enviadoEn,
    indicadores: record.indicadores,
    csat: record.csat,
    validaciones: VALIDACION_TIPOS.map((tipo) => {
      const v = record.validaciones[tipo];
      return {
        tipo,
        estado: v.estado,
        observacion: v.observacion || null,
        usuario: v.usuario,
        fecha: v.fecha,
        sharepointUrl: v.sharepointUrl,
        sharepointNombre: v.sharepointNombre,
      };
    }),
    miembros: d.unionesTemporales.map((m) => ({
      refId: m.id,
      nombre: m.nombre,
      participacionPct: m.participacionPct,
      empresa: m.empresa,
    })),
    alertas: record.alertas.map((a) => ({
      refId: a.id,
      tipo: a.tipo,
      estado: a.estado,
      descripcion: a.descripcion,
      fecha: a.fecha || null,
    })),
    historial: record.historialEstados.map((h) => ({
      estado: h.estado,
      fecha: h.fecha,
      origen: h.origen,
    })),
  };
}

/** `null` cuando la OUV todavía no tiene expediente diligenciado. */
export async function fetchWonSale(ouvId: string): Promise<WonSaleDto | null> {
  const response = await apiRequest<{ wonSale: WonSaleDto | null }>(
    `/offer-closing/ouvs/${ouvId}/won-sale`,
  );
  return response.wonSale;
}

export async function saveWonSale(
  record: VentaGanadaRecord,
): Promise<WonSaleDto> {
  return apiRequest<WonSaleDto>(
    `/offer-closing/ouvs/${record.ouvId}/won-sale`,
    { method: 'PUT', body: toPayload(record) },
  );
}

/**
 * Expedientes de varias OUV de una vez, para la bandeja.
 *
 * Se acota a los `ouvIds` que el usuario ya puede ver: el backend no devuelve
 * la tabla entera.
 */
export async function fetchWonSales(
  ouvIds: string[],
): Promise<Record<string, WonSaleDto>> {
  if (ouvIds.length === 0) return {};
  const response = await apiRequest<{ wonSales: WonSaleDto[] }>(
    `/offer-closing/won-sales${buildQueryString({ ouvIds: ouvIds.join(',') })}`,
  );
  return Object.fromEntries(response.wonSales.map((w) => [w.ouvId, w]));
}
