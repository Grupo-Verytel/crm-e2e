import { Users } from 'lucide-react';
import { formatDateTime } from '../../../lib/format';
import type { Ouv } from '../api/ouvs-api';
import {
  OUV_RESULTADO_LABEL,
  type OuvResultado,
} from '../lib/ouv-vocab';
import { OuvConfigMenu } from './OuvConfigMenu';
import { cardClass } from './ui';

function display(value: string | null | undefined): string {
  return value && value.trim() ? value : '—';
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="break-all text-sm text-ink">{value}</dd>
    </div>
  );
}

export function OuvDetailHeader({
  ouv,
  contactosCount,
  onOpenContactos,
  onAvanzar,
  onRetroceder,
  onCerrar,
}: {
  ouv: Ouv;
  contactosCount: number;
  onOpenContactos: () => void;
  onAvanzar: () => void;
  onRetroceder: () => void;
  onCerrar: () => void;
}) {
  const resultado = ouv.resultado as OuvResultado;
  const origenLabel =
    ouv.origen_via === 'directa' ? 'Directa' : 'Desde SQL';

  return (
    <header className={`${cardClass} mb-4 border border-border p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-ink">{ouv.titulo}</h1>
            <span
              className={[
                'inline-flex items-center rounded px-2 py-0.5 text-xs font-bold',
                resultado === 'EnCurso'
                  ? 'bg-turquoise/25 text-ink'
                  : resultado === 'Ganada'
                    ? 'bg-positive/20 text-ink'
                    : resultado === 'Perdida'
                      ? 'bg-danger/15 text-danger'
                      : 'bg-warning/20 text-ink',
              ].join(' ')}
            >
              {OUV_RESULTADO_LABEL[resultado] ?? ouv.resultado}
            </span>
            <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold bg-bg text-muted">
              {origenLabel}
            </span>
          </div>
          {ouv.descripcion ? (
            <p className="mt-1 text-sm text-muted">{ouv.descripcion}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="icon-btn relative grid h-9 w-9 place-items-center rounded"
            onClick={onOpenContactos}
            aria-label={`Contactos (${contactosCount})`}
            title="Contactos"
          >
            <Users size={18} strokeWidth={1.75} />
            {contactosCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-0.5 text-[10px] font-bold text-white">
                {contactosCount}
              </span>
            ) : null}
          </button>
          <OuvConfigMenu
            onContactos={onOpenContactos}
            onAvanzar={onAvanzar}
            onRetroceder={onRetroceder}
            onCerrar={onCerrar}
          />
        </div>
      </div>

      <dl className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-3">
        <div className="space-y-3">
          <DetailField label="OUV ID" value={ouv.ouv_id} />
          <DetailField label="Organización" value={display(ouv.empresa_nombre)} />
          <DetailField label="Proyecto" value="—" />
          <DetailField label="Ciudad" value="—" />
          <DetailField
            label="Estado OUV"
            value={OUV_RESULTADO_LABEL[resultado] ?? ouv.resultado}
          />
        </div>
        <div className="space-y-3">
          <DetailField
            label="Consecutivo"
            value={`${ouv.consecutivo} ${ouv.titulo}`.trim()}
          />
          <DetailField label="Segmento" value={display(ouv.segmento)} />
          <DetailField label="Plazo ejecución" value="—" />
          <DetailField label="Región" value="—" />
          <DetailField
            label="Fecha creación"
            value={formatDateTime(ouv.created_at)}
          />
        </div>
        <div className="space-y-3">
          <DetailField label="SQL ID" value={display(ouv.sql_id_origen)} />
          <DetailField label="Vertical" value={display(ouv.vertical)} />
          <DetailField label="Probabilidad de cierre" value="—" />
          <DetailField label="Etapa" value="Comercial" />
          <DetailField
            label="Fecha actualización"
            value={formatDateTime(ouv.updated_at)}
          />
        </div>
      </dl>
    </header>
  );
}
