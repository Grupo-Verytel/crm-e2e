import { useEffect, useRef, useState } from 'react';
import type { KickoffRecord } from '../../shared/project/types';
import { fetchMeetingAttendance, type GraphAttendance } from '../api/graph-api';

/** Consulta la asistencia en Teams una vez por cada valor de `trigger`. */
export function useKickoffAttendance(
  kickoff: KickoffRecord | null,
  trigger: number,
  onValidated: (informe: GraphAttendance) => void,
): GraphAttendance | null {
  const [attendance, setAttendance] = useState<GraphAttendance | null>(null);
  const onValidatedRef = useRef(onValidated);
  useEffect(() => {
    onValidatedRef.current = onValidated;
  }, [onValidated]);

  const organizerUpn = kickoff?.agenda?.organizerUpn?.trim() ?? '';
  const joinUrl =
    kickoff?.agenda?.joinUrl?.trim() || kickoff?.enlace.trim() || '';
  const inicio = kickoff?.agenda?.inicio ?? '';
  const pendiente =
    Boolean(kickoff?.agenda && organizerUpn && joinUrl) &&
    kickoff?.estado !== 'Cancelado' &&
    !(kickoff?.estado === 'Realizado' && kickoff.validadoTeams);

  const consultadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendiente || !inicio || new Date(inicio).getTime() > Date.now()) {
      return;
    }
    const clave = `${joinUrl}|${trigger}`;
    if (consultadoRef.current === clave) return;
    consultadoRef.current = clave;

    let cancelled = false;
    fetchMeetingAttendance({ organizerUpn, joinUrl })
      .then((informe) => {
        if (cancelled) return;
        setAttendance(informe);
        if (informe.reportId) onValidatedRef.current(informe);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pendiente, inicio, joinUrl, organizerUpn, trigger]);

  return attendance;
}
