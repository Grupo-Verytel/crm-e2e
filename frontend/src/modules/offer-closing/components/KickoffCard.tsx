import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import type { KickoffRecord } from '../../shared/project/types';
import { createEmptyKickoff } from '../../shared/project/mock-data';
import { formatKickoffRange } from '../lib/kickoff-scheduling';
import type { GraphAttendance } from '../api/graph-api';
import { KickoffProgramacionPanel } from './KickoffProgramacionPanel';
import type { KickoffInvitationContext } from '../api/graph-api';
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
  invitationContext?: KickoffInvitationContext;
  attendance?: GraphAttendance | null;
};

const ESTADO_TONE: Record<KickoffRecord['estado'], string> = {
  Programado: 'bg-turquoise/25 text-turquoise',
  Reagendado: 'bg-accent/15 text-accent',
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
  invitationContext,
  attendance = null,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [reagendar, setReagendar] = useState(false);
  const hasAgenda = Boolean(
    kickoff.agendamientoConfirmado && kickoff.agenda,
  );

  function openSchedule() {
    setReagendar(false);
    setModalOpen(true);
  }

  // El kickoff no cambia hasta confirmar en el modal: cerrarlo lo deja intacto.
  function startReagendar() {
    setReagendar(true);
    setModalOpen(true);
  }

  function eliminarKickoff() {
    // El backend cancela el evento en Microsoft 365 al borrar el kickoff.
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
                  ? 'Kickoff realizado'
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
          <KickoffProgramacionPanel
            kickoff={kickoff}
            attendance={attendance}
          />
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
        invitationContext={invitationContext}
        reagendar={reagendar}
      />
    </>
  );
}
