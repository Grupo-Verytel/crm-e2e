import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import type { KickoffRecord } from '../../shared/project/types';
import { createEmptyKickoff } from '../../shared/project/mock-data';
import { formatKickoffRange } from '../lib/kickoff-scheduling';
import { KickoffProgramacionPanel } from './KickoffProgramacionPanel';
import { KickoffScheduleModal } from './KickoffScheduleModal';
import {
  badgeClass,
  cardClass,
  ghostButtonClass,
  primaryButtonClass,
} from './ui';

type Props = {
  ouvId: string;
  accountId?: string | null;
  empresaNombre?: string | null;
  kickoff: KickoffRecord;
  onChange: (kickoff: KickoffRecord) => void;
};

const ESTADO_TONE: Record<KickoffRecord['estado'], string> = {
  Programado: 'bg-turquoise/25 text-turquoise',
  Realizado: 'bg-positive/15 text-positive',
  Cancelado: 'bg-border text-muted',
};

/**
 * Pestaña Kickoff:
 * - Sin agenda → CTA centrado "Agendar Kickoff" (abre modal con 3 pestañas).
 * - Con agenda → programación en página + Reagendar (reabre el modal).
 */
export function KickoffCard({
  ouvId,
  accountId = null,
  empresaNombre = null,
  kickoff,
  onChange,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const hasAgenda = Boolean(
    kickoff.agendamientoConfirmado && kickoff.agenda,
  );

  function openSchedule() {
    setModalOpen(true);
  }

  function startReagendar() {
    onChange({
      ...kickoff,
      agendamientoConfirmado: false,
      estado: 'Programado',
      fechaRealizacion: null,
      validadoTeams: false,
      aprobaciones: kickoff.aprobaciones.map((a) => ({
        ...a,
        completada: false,
      })),
    });
    setModalOpen(true);
  }

  function eliminarKickoff() {
    setModalOpen(false);
    onChange(createEmptyKickoff());
  }

  return (
    <>
      {hasAgenda ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted">
                {kickoff.estado === 'Realizado' && kickoff.validadoTeams
                  ? 'Etapa 4 · Confirmación del Kickoff'
                  : 'Kickoff agendado'}
              </p>
              {kickoff.agenda ? (
                <p className="mt-0.5 truncate text-sm text-ink">
                  {kickoff.agenda.nombreReunion}
                  <span className="text-muted">
                    {' '}
                    ·{' '}
                    {formatKickoffRange(
                      kickoff.agenda.inicio,
                      kickoff.agenda.fin,
                    )}
                  </span>
                  <span
                    className={`${badgeClass} ml-2 ${ESTADO_TONE[kickoff.estado]}`}
                  >
                    {kickoff.estado}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={ghostButtonClass}
                onClick={startReagendar}
              >
                Reagendar
              </button>
              <button
                type="button"
                className={ghostButtonClass}
                onClick={eliminarKickoff}
              >
                Eliminar evento
              </button>
            </div>
          </div>
          <KickoffProgramacionPanel kickoff={kickoff} onChange={onChange} />
        </div>
      ) : (
        <section
          className={`${cardClass} flex min-h-[22rem] flex-col items-center justify-center gap-4 p-8 text-center`}
        >
          <CalendarPlus size={36} className="text-accent" aria-hidden />
          <div className="max-w-md space-y-1">
            <h3 className="text-base font-bold text-ink">
              No hay Kickoff agendado
            </h3>
            <p className="text-sm text-muted">
              Agenda la sesión de transferencia con datos, disponibilidad y
              confirmación de programación.
            </p>
          </div>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={openSchedule}
          >
            Agendar Kickoff
          </button>
        </section>
      )}

      <KickoffScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        ouvId={ouvId}
        accountId={accountId}
        empresaNombre={empresaNombre}
        kickoff={kickoff}
        onChange={onChange}
      />
    </>
  );
}
