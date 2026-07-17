import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../auth/types';
import {
  fetchChecklist,
  fetchLeads,
  transitionLeadToMofu,
  transitionLeadToMql,
} from '../../api/leads-api';
import { useChecklistProgress } from '../../hooks/useChecklistProgress';
import {
  CHANNEL_ROUTES,
  KANBAN_COLUMNS,
  type KanbanColumn,
  type KanbanEstado,
} from '../../lib/lead-vocab';
import type { Checklist, Lead, LeadsQuery } from '../../types';
import type { LeadFilterValues } from '../../lib/lead-filters';
import { ChecklistModal } from './ChecklistModal';
import { LeadCard } from './LeadCard';
import { QuickInteractionModal } from './QuickInteractionModal';

const PAGE_SIZE = 15;

type ColumnState = {
  items: Lead[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;
};

const EMPTY_COLUMN: ColumnState = {
  items: [],
  total: 0,
  page: 1,
  loading: true,
  error: null,
};

function buildInitialColumns(): Record<KanbanEstado, ColumnState> {
  return KANBAN_COLUMNS.reduce(
    (acc, column) => ({ ...acc, [column.estado]: { ...EMPTY_COLUMN } }),
    {} as Record<KanbanEstado, ColumnState>,
  );
}

function isChecklistComplete(checklist: Checklist | null): boolean {
  return (
    !!checklist &&
    checklist.criterio_sector_objetivo &&
    checklist.criterio_necesidad_portafolio &&
    checklist.criterio_acceso_decisor &&
    checklist.criterio_presupuesto_indicios
  );
}

function friendlyTransitionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'TRANSITION_PRECONDITION_FAILED') {
      return 'Falta registrar al menos 1 interacción para pasar a nutrición.';
    }
    if (error.code === 'CHECKLIST_INCOMPLETE') {
      return 'Faltan criterios del checklist para enviar a aprobación.';
    }
    if (error.code === 'LEAD_LOCKED') {
      return 'El lead está en aprobación y no se puede mover.';
    }
    return error.message;
  }
  return 'No se pudo mover el lead. Inténtalo de nuevo.';
}

export function LeadsKanbanView({ filters }: { filters: LeadFilterValues }) {
  const [columns, setColumns] = useState<Record<KanbanEstado, ColumnState>>(
    buildInitialColumns,
  );
  const [dragged, setDragged] = useState<Lead | null>(null);
  const [dragOver, setDragOver] = useState<KanbanEstado | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [interactionFor, setInteractionFor] = useState<Lead | null>(null);
  const [checklistFor, setChecklistFor] = useState<Lead | null>(null);

  const filtersKey = JSON.stringify(filters);

  const buildQuery = useCallback(
    (estado: KanbanEstado, page: number): LeadsQuery => ({
      estado,
      canal_origen: filters.canal_origen || undefined,
      segmento: filters.segmento || undefined,
      campana_id: filters.campana_id || undefined,
      responsable_id: filters.responsable_id || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [filters],
  );

  const loadColumn = useCallback(
    async (estado: KanbanEstado, page: number, append: boolean) => {
      setColumns((prev) => ({
        ...prev,
        [estado]: { ...prev[estado], loading: true, error: null },
      }));
      try {
        const data = await fetchLeads(buildQuery(estado, page));
        setColumns((prev) => ({
          ...prev,
          [estado]: {
            items: append ? [...prev[estado].items, ...data.items] : data.items,
            total: data.total,
            page,
            loading: false,
            error: null,
          },
        }));
      } catch {
        setColumns((prev) => ({
          ...prev,
          [estado]: {
            ...prev[estado],
            loading: false,
            error: 'No se pudieron cargar los leads.',
          },
        }));
      }
    },
    [buildQuery],
  );

  const reloadAll = useCallback(() => {
    KANBAN_COLUMNS.forEach((column) => void loadColumn(column.estado, 1, false));
  }, [loadColumn]);

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on filter change
  }, [filtersKey]);

  const checklistProgress = useChecklistProgress([
    ...columns.TOFU.items,
    ...columns.MOFU.items,
  ]);

  function setCardError(leadId: string, message: string | null) {
    setCardErrors((prev) => {
      const next = { ...prev };
      if (message) {
        next[leadId] = message;
      } else {
        delete next[leadId];
      }
      return next;
    });
  }

  const columnAccepts = useCallback(
    (column: KanbanColumn): boolean => {
      if (!dragged || column.readOnly) {
        return false;
      }

      if (dragged.canal_origen === 'FABRICA' && column.estado === 'MQL_PENDING') {
        return dragged.estado === 'TOFU';
      }

      if (
        dragged.canal_origen === 'GENERACION_DEMANDA_AGENCIA' &&
        column.estado === 'MQL_PENDING'
      ) {
        return false;
      }

      return column.acceptsFrom === dragged.estado;
    },
    [dragged],
  );

  async function promoteToMofu(lead: Lead) {
    setBusyLeadId(lead.lead_id);
    setCardError(lead.lead_id, null);
    try {
      await transitionLeadToMofu(lead.lead_id);
      reloadAll();
    } catch (error) {
      setCardError(lead.lead_id, friendlyTransitionError(error));
    } finally {
      setBusyLeadId(null);
    }
  }

  function handleDropToMofu(lead: Lead) {
    setCardError(lead.lead_id, null);
    if (lead.segmento === 'B2B' && !lead.industria) {
      setCardError(
        lead.lead_id,
        'Falta la industria (requerida para B2B). Ábrelo para completarla.',
      );
      return;
    }
    if (!lead.fecha_ultima_interaccion) {
      setInteractionFor(lead);
      return;
    }
    void promoteToMofu(lead);
  }

  async function handleDropToMql(lead: Lead) {
    setCardError(lead.lead_id, null);
    setBusyLeadId(lead.lead_id);
    try {
      const checklist = await fetchChecklist(lead.lead_id);
      if (isChecklistComplete(checklist)) {
        await transitionLeadToMql(lead.lead_id);
        reloadAll();
      } else {
        setChecklistFor(lead);
      }
    } catch (error) {
      setCardError(lead.lead_id, friendlyTransitionError(error));
    } finally {
      setBusyLeadId(null);
    }
  }

  function handleDrop(column: KanbanColumn) {
    const lead = dragged;
    setDragOver(null);
    setDragged(null);
    if (!lead || !columnAccepts(column)) {
      return;
    }
    if (column.estado === 'MOFU') {
      handleDropToMofu(lead);
    } else if (column.estado === 'MQL_PENDING') {
      void handleDropToMql(lead);
    }
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {KANBAN_COLUMNS.map((column) => {
          const state = columns[column.estado];
          const route = filters.canal_origen
            ? CHANNEL_ROUTES[filters.canal_origen]
            : undefined;
          const applies = !route || route.includes(column.estado);
          const accepts = columnAccepts(column);
          const blocked = !!dragged && column.readOnly;
          const isDropTarget = dragOver === column.estado && accepts;

          return (
            <section
              key={column.estado}
              onDragOver={(event) => {
                if (accepts) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  if (dragOver !== column.estado) {
                    setDragOver(column.estado);
                  }
                } else {
                  event.dataTransfer.dropEffect = 'none';
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(column);
              }}
              className={[
                'flex w-80 shrink-0 flex-col rounded',
                column.readOnly
                  ? 'border border-dashed border-border bg-bg/60'
                  : 'bg-bg',
                isDropTarget ? 'outline outline-2 outline-brand' : '',
                blocked ? 'cursor-not-allowed' : '',
                !applies ? 'opacity-40' : '',
              ].join(' ')}
            >
              <header className="flex items-start justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-ink">{column.label}</h2>
                  <p className="text-xs text-muted">{column.hint}</p>
                  {!applies ? (
                    <p className="text-xs font-bold text-muted">No aplica</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-sm border border-border bg-surface px-2 py-0.5 text-xs font-bold text-muted">
                  {state.total}
                </span>
              </header>

              <div className="flex-1 space-y-2 px-3 pb-3">
                {state.loading && state.items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">Cargando…</p>
                ) : state.error ? (
                  <p className="py-6 text-center text-xs text-danger">
                    {state.error}
                  </p>
                ) : state.items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">
                    Sin leads aquí.
                  </p>
                ) : (
                  <>
                    {state.items.map((lead) => (
                      <LeadCard
                        key={lead.lead_id}
                        lead={lead}
                        draggable={
                          column.estado === 'TOFU' || column.estado === 'MOFU'
                        }
                        onDragStart={() => setDragged(lead)}
                        onDragEnd={() => {
                          setDragged(null);
                          setDragOver(null);
                        }}
                        showChecklist={
                          column.estado === 'MOFU' ||
                          (column.estado === 'TOFU' &&
                            lead.canal_origen === 'FABRICA')
                        }
                        showRoute={!filters.canal_origen}
                        checklistProgress={
                          column.estado === 'MOFU' ||
                          (column.estado === 'TOFU' &&
                            lead.canal_origen === 'FABRICA')
                            ? checklistProgress(lead.lead_id)
                            : undefined
                        }
                        errorMessage={cardErrors[lead.lead_id] ?? null}
                        busy={busyLeadId === lead.lead_id}
                      />
                    ))}

                    {state.items.length < state.total ? (
                      <button
                        type="button"
                        onClick={() =>
                          void loadColumn(column.estado, state.page + 1, true)
                        }
                        disabled={state.loading}
                        className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs font-bold text-ink hover:bg-bg disabled:opacity-40"
                      >
                        Cargar más ({state.total - state.items.length} restantes)
                      </button>
                    ) : null}
                  </>
                )}

                {column.readOnly ? (
                  <p className="pt-1 text-[11px] text-muted">
                    Solo el Director promueve a calificado desde la Bandeja MQL.
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {interactionFor ? (
        <QuickInteractionModal
          leadId={interactionFor.lead_id}
          leadName={interactionFor.empresa_nombre}
          onRegistered={() => promoteToMofu(interactionFor)}
          onClose={() => setInteractionFor(null)}
        />
      ) : null}

      {checklistFor ? (
        <ChecklistModal
          leadId={checklistFor.lead_id}
          leadName={checklistFor.empresa_nombre}
          onQualified={() => reloadAll()}
          onSaved={() =>
            loadColumn(
              checklistFor.canal_origen === 'FABRICA' ? 'TOFU' : 'MOFU',
              1,
              false,
            )
          }
          onClose={() => setChecklistFor(null)}
        />
      ) : null}
    </>
  );
}
