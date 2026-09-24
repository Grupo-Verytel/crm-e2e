import { useState } from 'react';
import type {
  OuvContacto,
  OuvInfluencia,
  OuvInfluenciaFiltro,
} from '../api/ouvs-api';
import { EMPTY_INFLUENCIA_FILTRO } from '../api/ouvs-api';
import {
  INFLUENCIA_TIPOS,
  type InfluenciaEstado,
  type InfluenciaTipo,
} from '../lib/ouv-vocab';
import { InfluenciaCard } from './InfluenciaCard';
import { InfluenciaDetallePanel } from './InfluenciaDetallePanel';
import { cardClass } from './ui';

type Props = {
  influencias: OuvInfluencia[];
  filtro?: OuvInfluenciaFiltro;
  contactos: OuvContacto[];
  editable: boolean;
  savingId: string | null;
  onAddExisting: (tipo: InfluenciaTipo, contactoOuvId: string) => void;
  onCreateContact: (tipo: InfluenciaTipo) => void;
  onRate: (
    tipo: InfluenciaTipo,
    contactoOuvId: string,
    estado: InfluenciaEstado,
  ) => void;
  onRemove: (tipo: InfluenciaTipo, contactoOuvId: string) => void;
  onOpenNota: (tipo: InfluenciaTipo, contactoOuvId: string) => void;
};

export function InfluenciasSection({
  influencias,
  filtro = EMPTY_INFLUENCIA_FILTRO,
  contactos,
  editable,
  savingId,
  onAddExisting,
  onCreateContact,
  onRate,
  onRemove,
  onOpenNota,
}: Props) {
  const [selectedTipo, setSelectedTipo] = useState<InfluenciaTipo>(
    INFLUENCIA_TIPOS[0],
  );
  const selectedRows = influencias.filter((row) => row.tipo === selectedTipo);
  const tipId = 'influencia-filtro-tip';
  const greenCount = filtro.greenTypes.length;

  return (
    <section className={`${cardClass} mb-4 p-4`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">Influencias</h2>
        <span className="group relative">
          <span
            tabIndex={0}
            aria-describedby={tipId}
            className={`inline-flex rounded px-2 py-0.5 text-xs font-bold ${
              filtro.passed
                ? 'bg-semaphore-verde/15 text-semaphore-verde'
                : 'bg-bg text-muted'
            }`}
          >
            Filtro: {greenCount} de {filtro.required} tipos en verde
          </span>
          <span
            id={tipId}
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden w-64 rounded border border-border bg-surface p-2 text-xs text-ink shadow-card group-hover:block group-focus-within:block"
          >
            Requiere al menos 1 contacto en Verde en 2 tipos distintos entre
            Económica, Técnica y Fábrica
          </span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {INFLUENCIA_TIPOS.map((tipo) => (
          <InfluenciaCard
            key={tipo}
            tipo={tipo}
            rows={influencias.filter((row) => row.tipo === tipo)}
            contactos={contactos}
            countsForFilter={filtro.greenTypes.includes(tipo)}
            selected={selectedTipo === tipo}
            onSelect={setSelectedTipo}
          />
        ))}
      </div>
      <div className="mt-3">
        <InfluenciaDetallePanel
          tipo={selectedTipo}
          rows={selectedRows}
          contactos={contactos}
          editable={editable}
          savingId={savingId}
          onAddExisting={(contactoOuvId) =>
            onAddExisting(selectedTipo, contactoOuvId)
          }
          onCreateContact={() => onCreateContact(selectedTipo)}
          onRate={(contactoOuvId, estado) =>
            onRate(selectedTipo, contactoOuvId, estado)
          }
          onRemove={(contactoOuvId) => onRemove(selectedTipo, contactoOuvId)}
          onOpenNota={(contactoOuvId) => onOpenNota(selectedTipo, contactoOuvId)}
        />
      </div>
    </section>
  );
}
