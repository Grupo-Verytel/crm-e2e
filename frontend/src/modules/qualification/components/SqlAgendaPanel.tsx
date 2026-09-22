import type { SqlCita, SqlCitaPlanificada } from '../api/sqls-api';
import {
  AGENDA_SEGUIMIENTO_LABELS,
  AGENDA_SEGUIMIENTO_TONE,
  formatPlannedCita,
  formatScheduledCita,
  hasPlannedCita,
  hasScheduledCita,
  resolveAgendaSeguimientoStatus,
} from '../lib/sql-appointments';
import { cardClass } from './ui';

type AgendaProps = {
  citaPlanificada: SqlCitaPlanificada | null | undefined;
  cita: SqlCita | null | undefined;
};

export function SqlAgendaStatusModule({
  citaPlanificada,
  cita,
}: AgendaProps) {
  const status = resolveAgendaSeguimientoStatus(citaPlanificada, cita);

  return (
    <section className={`${cardClass} flex h-full flex-col p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Seguimiento de agenda</h2>
          <p className="mt-1 text-xs text-muted">
            Compara la cita planificada en Calificación con la cita agendada del
            comercial para este SQL.
          </p>
        </div>
        <span
          className={`rounded px-2 py-1 text-xs font-bold ${AGENDA_SEGUIMIENTO_TONE[status]}`}
        >
          {AGENDA_SEGUIMIENTO_LABELS[status]}
        </span>
      </div>
    </section>
  );
}

export function SqlPlannedCitaModule({ citaPlanificada }: AgendaProps) {
  const planned = hasPlannedCita(citaPlanificada);

  return (
    <section className={`${cardClass} flex h-full flex-col p-5`}>
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
        Cita planificada (Calificación)
      </h3>
      {planned ? (
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Fecha y hora</dt>
            <dd className="text-right font-bold text-ink">
              {formatPlannedCita(citaPlanificada)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Sin cita planificada al aprobar el MQL.
        </p>
      )}
      <p className="mt-auto pt-3 text-xs text-muted">
        Registrada en la etapa de Calificación antes de asignar el SQL.
      </p>
    </section>
  );
}

export function SqlScheduledCitaModule({ cita }: Pick<AgendaProps, 'cita'>) {
  const scheduled = hasScheduledCita(cita);

  return (
    <section className={`${cardClass} flex h-full flex-col p-5`}>
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
        Cita agendada
      </h3>
      {scheduled ? (
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Fecha y hora</dt>
            <dd className="text-right font-bold text-ink">{formatScheduledCita(cita)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Contacto</dt>
            <dd className="text-right text-ink">{cita!.contacto_nombre}</dd>
          </div>
          {cita!.contacto_cargo ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Cargo</dt>
              <dd className="text-right text-ink">{cita!.contacto_cargo}</dd>
            </div>
          ) : null}
          {cita!.descripcion ? (
            <div>
              <dt className="text-muted">Descripción</dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink">{cita!.descripcion}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Aún no hay cita agendada en Teams para este SQL.
        </p>
      )}
      <p className="mt-auto pt-3 text-xs text-muted">
        Se crea al asignar el SQL con la opción de generar reunión en Teams.
      </p>
    </section>
  );
}

/** Legacy wrapper — prefer modular grid on SqlDetailPage. */
export function SqlAgendaPanel(props: AgendaProps) {
  return (
    <div className="space-y-4">
      <SqlAgendaStatusModule {...props} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SqlPlannedCitaModule {...props} />
        <SqlScheduledCitaModule cita={props.cita} />
      </div>
    </div>
  );
}
