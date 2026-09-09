import { Users } from 'lucide-react';
import { formatDateTime } from '../../../lib/format';
import type { Ouv } from '../api/ouvs-api';
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
  onEditar,
  onAvanzar,
  onRetroceder,
  onCerrar,
}: {
  ouv: Ouv;
  contactosCount: number;
  onOpenContactos: () => void;
  onEditar: () => void;
  onAvanzar: () => void;
  onRetroceder: () => void;
  onCerrar: () => void;
}) {
  return (
    <header className={`${cardClass} mb-4 border border-border p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-ink">{ouv.titulo}</h1>
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
            onEditar={onEditar}
            onContactos={onOpenContactos}
            onAvanzar={onAvanzar}
            onRetroceder={onRetroceder}
            onCerrar={onCerrar}
          />
        </div>
      </div>

      <dl className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-3">
        <div className="space-y-3">
          <DetailField label="Organización" value={display(ouv.empresa_nombre)} />
          <DetailField label="Proyecto" value="—" />
          <DetailField label="Ciudad" value={display(ouv.city)} />
        </div>
        <div className="space-y-3">
          <DetailField label="Segmento" value={display(ouv.segmento)} />
          <DetailField label="Plazo ejecución" value="—" />
          <DetailField label="Región" value={display(ouv.region)} />
          <DetailField
            label="Fecha creación"
            value={formatDateTime(ouv.created_at)}
          />
        </div>
        <div className="space-y-3">
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
