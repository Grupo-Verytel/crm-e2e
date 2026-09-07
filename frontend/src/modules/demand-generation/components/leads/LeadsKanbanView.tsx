import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ApiError } from '../../../auth/types';
import {
  discardLead,
  fetchChecklist,
  fetchLeads,
  transitionLeadToMofu,
  transitionLeadToMql,
} from '../../api/leads-api';
import { useChecklistProgress } from '../../hooks/useChecklistProgress';
import {
  CHANNEL_ROUTES,
  KANBAN_COLUMNS,
  leadDisplayName,
  type KanbanColumn,
  type KanbanEstado,
} from '../../lib/lead-vocab';
import type { Checklist, Lead, LeadsQuery } from '../../types';
import type { LeadFilterValues } from '../../lib/lead-filters';
import { MotivoModal } from '../MotivoModal';
import { cardClass } from '../ui';
import { ChecklistModal } from './ChecklistModal';
import { LeadCard } from './LeadCard';
import { QuickInteractionModal } from './QuickInteractionModal';
import { RegisterAppointmentModal } from './RegisterAppointmentModal';

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

type Props = {
  filters: LeadFilterValues;
  /** Traductor / follow-up: no drag and no transitions. */
  readOnly?: boolean;
};

export function LeadsKanbanView({ filters, readOnly = false }: Props) {
  const [columns, setColumns] = useState<Record<KanbanEstado, ColumnState>>(
    buildInitialColumns,
  );
  const [dragged, setDragged] = useState<Lead | null>(null);
  const [dragOver, setDragOver] = useState<KanbanEstado | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [interactionFor, setInteractionFor] = useState<Lead | null>(null);
  const [checklistFor, setChecklistFor] = useState<Lead | null>(null);
  const [appointmentFor, setAppointmentFor] = useState<Lead | null>(null);
  const [discardFor, setDiscardFor] = useState<Lead | null>(null);
  const [collapsed, setCollapsed] = useState<Partial<Record<KanbanEstado, boolean>>>(
    {},
  );

  const filtersKey = JSON.stringify(filters);

  function toggleCollapsed(estado: KanbanEstado) {
    setCollapsed((prev) => ({ ...prev, [estado]: !prev[estado] }));
  }

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
      if (readOnly || !dragged || column.readOnly) {
        return false;
      }

      if (dragged.canal_origen === 'FABRICA' && column.estado === 'MQL_PENDING') {
        return dragged.estado === 'TOFU';
      }

      if (
        dragged.canal_origen === 'GENERACION_DEMANDA_AGENCIA' &&
        column.estado === 'MQL_PENDING'
      ) {
        return dragged.estado === 'MOFU';
      }

      return column.acceptsFrom === dragged.estado;
    },
    [dragged, readOnly],
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

    if (lead.canal_origen === 'GENERACION_DEMANDA_AGENCIA') {
      setAppointmentFor(lead);
      return;
    }

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
    if (readOnly) return;
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
      <div className="grid items-start gap-3 lg:grid-cols-4">
        {KANBAN_COLUMNS.map((column) => {
          const state = columns[column.estado];
          const route = filters.canal_origen
            ? CHANNEL_ROUTES[filters.canal_origen]
            : undefined;
          const applies = !route || route.includes(column.estado);
          const accepts = columnAccepts(column);
          const isDropTarget = dragOver === column.estado && accepts;
          const isSqlTray = column.estado === 'SQL';
          const isCollapsed = !!collapsed[column.estado];

          return (
            <section
              key={column.estado}
              onDragOver={(event) => {
                if (accepts && !isCollapsed) {
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
                if (!isCollapsed) handleDrop(column);
              }}
              className={[
                `${cardClass} flex flex-col p-3`,
                isCollapsed ? 'min-h-0' : 'min-h-64',
                isSqlTray
                  ? 'border border-semaphore-verde/45 hover:border-semaphore-verde/60'
                  : '',
                isDropTarget ? 'outline outline-2 outline-accent' : '',
                !applies ? 'opacity-40' : '',
              ].join(' ')}
            >
              <header className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(column.estado)}
                  aria-expanded={!isCollapsed}
                  title={isCollapsed ? 'Expandir bandeja' : 'Colapsar bandeja'}
                  className="min-w-0 flex-1 rounded text-left hover:opacity-90"
                >
                  <div className="flex items-center gap-1.5">
                    {isCollapsed ? (
                      <ChevronRight
                        size={16}
                        strokeWidth={2}
                        className="shrink-0 text-muted"
                        aria-hidden
                      />
                    ) : (
                      <ChevronDown
                        size={16}
                        strokeWidth={2}
                        className="shrink-0 text-muted"
                        aria-hidden
                      />
                    )}
                    <h2 className="text-sm font-bold text-ink">
                      {column.label}
                    </h2>
                  </div>
                  {!isCollapsed ? (
                    <>
                      <p className="mt-0.5 pl-[22px] text-xs text-muted">
                        {column.hint}
                      </p>
                      {!applies ? (
                        <p className="pl-[22px] text-xs font-bold text-muted">
                          No aplica
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </button>
                <span className="shrink-0 rounded-sm border border-border bg-bg px-2 py-0.5 text-xs font-bold text-muted">
                  {state.total}
                </span>
              </header>

              {!isCollapsed ? (
              <div className="mt-3 flex-1 space-y-2">
                {state.loading && state.items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">Cargando…</p>
                ) : state.error ? (
                  <p className="py-6 text-center text-xs text-danger">
                    {state.error}
                  </p>
                ) : state.items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">Vacío</p>
                ) : (
                  <>
                    {state.items.map((lead) => (
                      <LeadCard
                        key={lead.lead_id}
                        lead={lead}
                        variant={isSqlTray ? 'ouv' : 'default'}
                        draggable={
                          !readOnly &&
                          (column.estado === 'TOFU' || column.estado === 'MOFU')
                        }
                        onDragStart={() => setDragged(lead)}
                        onDragEnd={() => {
                          setDragged(null);
                          setDragOver(null);
                        }}
                        showChecklist={
                          !readOnly &&
                          (column.estado === 'MOFU' ||
                            (column.estado === 'TOFU' &&
                              lead.canal_origen === 'FABRICA'))
                        }
                        showRoute={!filters.canal_origen && !readOnly}
                        checklistProgress={
                          column.estado === 'MOFU' ||
                          (column.estado === 'TOFU' &&
                            lead.canal_origen === 'FABRICA')
                            ? checklistProgress(lead.lead_id)
                            : undefined
                        }
                        errorMessage={cardErrors[lead.lead_id] ?? null}
                        busy={busyLeadId === lead.lead_id}
                        onDiscard={
                          !readOnly &&
                          (column.estado === 'TOFU' ||
                            column.estado === 'MOFU' ||
                            column.estado === 'MQL_PENDING')
                            ? setDiscardFor
                            : undefined
                        }
                      />
                    ))}

                    {state.items.length < state.total ? (
                      <button
                        type="button"
                        onClick={() =>
                          void loadColumn(column.estado, state.page + 1, true)
                        }
                        disabled={state.loading}
                        className="btn-glow-outline w-full rounded px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                      >
                        Cargar más ({state.total - state.items.length} restantes)
                      </button>
                    ) : null}
                  </>
                )}

                {isSqlTray && !readOnly ? (
                  <p className="pt-1 text-[11px] text-muted">
                    Solo el Director promueve a calificado desde la Bandeja MQL.
                  </p>
                ) : null}
              </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {!readOnly && interactionFor ? (
        <QuickInteractionModal
          leadId={interactionFor.lead_id}
          leadName={leadDisplayName(interactionFor)}
          onRegistered={() => promoteToMofu(interactionFor)}
          onClose={() => setInteractionFor(null)}
        />
      ) : null}

      {!readOnly && checklistFor ? (
        <ChecklistModal
          leadId={checklistFor.lead_id}
          leadName={leadDisplayName(checklistFor)}
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

      {!readOnly && appointmentFor ? (
        <RegisterAppointmentModal
          lead={appointmentFor}
          onRegistered={() => {
            setAppointmentFor(null);
            reloadAll();
          }}
          onClose={() => setAppointmentFor(null)}
        />
      ) : null}

      {!readOnly && discardFor ? (
        <MotivoModal
          title={`Eliminar lead · ${leadDisplayName(discardFor)}`}
          confirmLabel="Eliminar"
          placeholder="Motivo del descarte (obligatorio)."
          onConfirm={async (motivo) => {
            await discardLead(discardFor.lead_id, motivo);
            setDiscardFor(null);
            reloadAll();
          }}
          onClose={() => setDiscardFor(null)}
        />
      ) : null}
    </>
  );
}
