import { useState } from 'react';
import type { OuvContacto, OuvInfluencia } from '../api/ouvs-api';
import {
  INFLUENCIA_TIPOS,
  type InfluenciaTipo,
} from '../lib/ouv-vocab';
import { InfluenciaCard } from './InfluenciaCard';
import {
  InfluenciaDetallePanel,
  type InfluenciaFieldPatch,
} from './InfluenciaDetallePanel';
import { cardClass } from './ui';

type Props = {
  influencias: OuvInfluencia[];
  contactos: OuvContacto[];
  editable: boolean;
  savingTipos: Partial<Record<InfluenciaTipo, boolean>>;
  justSavedTipo: InfluenciaTipo | null;
  onFieldChange: (tipo: InfluenciaTipo, patch: InfluenciaFieldPatch) => void;
  onNotasChange: (tipo: InfluenciaTipo, notas: string) => void;
  onNotasBlur: (tipo: InfluenciaTipo) => void;
  onAddContact: (tipo: InfluenciaTipo) => void;
};

export function InfluenciasSection({
  influencias,
  contactos,
  editable,
  savingTipos,
  justSavedTipo,
  onFieldChange,
  onNotasChange,
  onNotasBlur,
  onAddContact,
}: Props) {
  const [selectedTipo, setSelectedTipo] = useState<InfluenciaTipo>(
    INFLUENCIA_TIPOS[0],
  );
  const selectedInf = influencias.find((row) => row.tipo === selectedTipo);

  return (
    <section className={`${cardClass} mb-4 p-4`}>
      <h2 className="mb-3 text-sm font-bold text-ink">Influencias</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {INFLUENCIA_TIPOS.map((tipo) => {
          const inf = influencias.find((x) => x.tipo === tipo);
          return (
            <InfluenciaCard
              key={tipo}
              tipo={tipo}
              inf={inf}
              assignedContact={contactos.find(
                (c) => c.contacto_ouv_id === inf?.contacto_ouv_id,
              )}
              selected={selectedTipo === tipo}
              onSelect={setSelectedTipo}
            />
          );
        })}
      </div>
      <div className="mt-3">
        <InfluenciaDetallePanel
          key={selectedTipo}
          tipo={selectedTipo}
          inf={selectedInf}
          assignedContact={contactos.find(
            (c) => c.contacto_ouv_id === selectedInf?.contacto_ouv_id,
          )}
          contactos={contactos}
          editable={editable}
          isSaving={Boolean(savingTipos[selectedTipo])}
          justSaved={justSavedTipo === selectedTipo}
          onFieldChange={onFieldChange}
          onNotasChange={onNotasChange}
          onNotasBlur={onNotasBlur}
          onAddContact={onAddContact}
        />
      </div>
    </section>
  );
}
