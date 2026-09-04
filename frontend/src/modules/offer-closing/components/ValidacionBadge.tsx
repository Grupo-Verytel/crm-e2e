import type { ValidacionEstado, ValidacionTipo } from '../../shared/project/types';
import { VALIDACION_ESTADO_LABEL } from '../../shared/project/types';
import { badgeClass } from './ui';

const TONE: Record<ValidacionEstado, string> = {
  Pendiente: 'bg-border text-muted',
  Aprobado: 'bg-positive/15 text-positive',
  Rechazado: 'bg-danger/15 text-danger',
};

export function ValidacionBadge({
  tipo,
  estado,
}: {
  tipo: ValidacionTipo;
  estado: ValidacionEstado;
}) {
  return (
    <span className={`${badgeClass} ${TONE[estado]}`} title={tipo}>
      {tipo === 'Tecnica' ? 'Técn.' : 'Fin.'}. {VALIDACION_ESTADO_LABEL[estado]}
    </span>
  );
}
