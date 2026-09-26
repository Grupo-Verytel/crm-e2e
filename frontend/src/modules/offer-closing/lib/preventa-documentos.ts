import type { SolicitudPreventa } from '../../discovery/api/solicitudes-preventa-api';
import { sharePointDocumentName } from '../../discovery/lib/sharepoint-document';
import { derivarMepStatus } from '../../discovery/lib/solicitud-preventa-rules';
import type {
  ValidacionRecord,
  ValidacionTipo,
  VentaGanadaRecord,
} from '../../shared/project/types';
import { VALIDACION_TIPOS } from '../../shared/project/types';

const SERVICIO_POR_TIPO: Record<ValidacionTipo, string> = {
  Tecnica: 'TECHNICAL_DESIGN',
  Financiera: 'FINANCIAL_DESIGN',
};

type Documento = Pick<ValidacionRecord, 'sharepointUrl' | 'sharepointNombre'>;

export function documentosPreventa(
  solicitudes: SolicitudPreventa[],
): Record<ValidacionTipo, Documento> {
  const completadas = solicitudes.filter(
    (s) => derivarMepStatus(s) === 'Completado',
  );
  return Object.fromEntries(
    VALIDACION_TIPOS.map((tipo) => {
      let url: string | null = null;
      for (const solicitud of completadas) {
        const servicio = solicitud.servicios.find(
          (s) => s.service === SERVICIO_POR_TIPO[tipo],
        );
        url =
          servicio?.entregables[0]?.url ??
          (servicio ? solicitud.sharepoint_document_url : null);
        if (url) break;
      }
      return [
        tipo,
        {
          sharepointUrl: url,
          sharepointNombre: url ? sharePointDocumentName(url) : null,
        },
      ];
    }),
  ) as Record<ValidacionTipo, Documento>;
}

export function applyDocumentosPreventa(
  record: VentaGanadaRecord,
  documentos: Record<ValidacionTipo, Documento>,
): VentaGanadaRecord {
  const validaciones = { ...record.validaciones };
  for (const tipo of VALIDACION_TIPOS) {
    validaciones[tipo] = { ...validaciones[tipo], ...documentos[tipo] };
  }
  return { ...record, validaciones };
}
