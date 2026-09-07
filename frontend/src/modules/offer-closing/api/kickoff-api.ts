// Kickoff persistido en el backend (`api/v1/offer-closing/ouvs/:ouvId/kickoff`).
//
// Sustituye al almacenamiento en `localStorage`: el kickoff apunta a un evento
// real de Microsoft 365, así que su estado tiene que ser el mismo para todos
// los usuarios y sobrevivir al navegador que lo creó.
import { apiRequest } from '../../../lib/api/http-client';
import { ApiError } from '../../auth/types';
import { createEmptyKickoff } from '../../shared/project/mock-data';
import type {
  KickoffEstado,
  KickoffInvitee,
  KickoffInviteeTipo,
  KickoffRecord,
  KickoffSalaVerytel,
  KickoffUbicacionTipo,
} from '../../shared/project/types';

type KickoffInviteeDto = {
  kickoffInviteeId?: string;
  email: string;
  displayName: string;
  inviteeType: KickoffInviteeTipo;
  sourceRef?: string | null;
};

type KickoffApprovalDto = {
  kickoffApprovalId?: string;
  code: string;
  label: string;
  completed: boolean;
  completedAt?: string | null;
};

export type KickoffDto = {
  kickoffId: string;
  ouvId: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
  locationTypes: KickoffUbicacionTipo[];
  roomEmail: string | null;
  roomLabel: string | null;
  locationDetail: string | null;
  notes: string | null;
  status: KickoffEstado;
  schedulingConfirmed: boolean;
  teamsValidated: boolean;
  heldAt: string | null;
  graphEventId: string | null;
  graphOrganizerUpn: string | null;
  joinUrl: string | null;
  webLink: string | null;
  confirmedAt: string | null;
  invitees: KickoffInviteeDto[];
  approvals: KickoffApprovalDto[];
  createdAt: string;
  updatedAt: string;
};

type SaveKickoffPayload = Omit<
  KickoffDto,
  'kickoffId' | 'ouvId' | 'createdAt' | 'updatedAt' | 'invitees' | 'approvals'
> & {
  invitees: KickoffInviteeDto[];
  approvals: { code: string; label: string; completed: boolean }[];
};

function dateOnly(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** DTO del backend → forma que ya consumen los componentes del kickoff. */
export function kickoffFromDto(dto: KickoffDto): KickoffRecord {
  const base = createEmptyKickoff();
  const invitados: KickoffInvitee[] = dto.invitees.map((inv) => ({
    id: inv.sourceRef ?? inv.email,
    email: inv.email,
    nombre: inv.displayName,
    tipo: inv.inviteeType,
  }));

  const aprobaciones = base.aprobaciones.map((a) => {
    const found = dto.approvals.find((x) => x.code === a.id);
    return found ? { ...a, label: found.label, completada: found.completed } : a;
  });

  return {
    sesionNombre: dto.name,
    sesionFecha: dateOnly(dto.startsAt),
    enlace: dto.joinUrl ?? dto.webLink ?? '',
    estado: dto.status,
    fechaRealizacion: dto.heldAt,
    aprobaciones,
    validadoTeams: dto.teamsValidated,
    agendamientoConfirmado: dto.schedulingConfirmed,
    agenda:
      dto.startsAt && dto.endsAt
        ? {
            nombreReunion: dto.name,
            invitados,
            inicio: dto.startsAt,
            fin: dto.endsAt,
            ubicaciones: dto.locationTypes,
            salaVerytel: (dto.roomLabel as KickoffSalaVerytel | null) ?? null,
            ubicacionDetalle: dto.locationDetail,
            observacionesInvitados: dto.notes ?? '',
            confirmadaEn: dto.confirmedAt ?? dto.updatedAt,
            graphEventId: dto.graphEventId,
            organizerUpn: dto.graphOrganizerUpn,
            joinUrl: dto.joinUrl,
          }
        : null,
  };
}

function kickoffToPayload(record: KickoffRecord): SaveKickoffPayload {
  const agenda = record.agenda;

  return {
    name: agenda?.nombreReunion?.trim() || record.sesionNombre.trim() || 'Kickoff',
    startsAt: agenda?.inicio ?? null,
    endsAt: agenda?.fin ?? null,
    timeZone: 'America/Bogota',
    locationTypes: agenda?.ubicaciones ?? [],
    roomEmail: null,
    roomLabel: agenda?.salaVerytel ?? null,
    locationDetail: agenda?.ubicacionDetalle ?? null,
    notes: agenda?.observacionesInvitados ?? null,
    status: record.estado,
    schedulingConfirmed: record.agendamientoConfirmado,
    teamsValidated: record.validadoTeams,
    heldAt: record.fechaRealizacion,
    graphEventId: agenda?.graphEventId ?? null,
    graphOrganizerUpn: agenda?.organizerUpn ?? null,
    joinUrl: agenda?.joinUrl ?? record.enlace ?? null,
    webLink: null,
    confirmedAt: agenda?.confirmadaEn ?? null,
    invitees: (agenda?.invitados ?? []).map((inv) => ({
      email: inv.email,
      displayName: inv.nombre,
      inviteeType: inv.tipo,
      sourceRef: inv.id,
    })),
    approvals: record.aprobaciones.map((a) => ({
      code: a.id,
      label: a.label,
      completed: a.completada,
    })),
  };
}

/** `null` cuando la OUV aún no tiene kickoff agendado — no es un error. */
export async function fetchKickoff(
  ouvId: string,
): Promise<KickoffRecord | null> {
  const response = await apiRequest<{ kickoff: KickoffDto | null }>(
    `/offer-closing/ouvs/${ouvId}/kickoff`,
  );
  return response.kickoff ? kickoffFromDto(response.kickoff) : null;
}

export async function saveKickoff(
  ouvId: string,
  record: KickoffRecord,
): Promise<KickoffRecord> {
  const dto = await apiRequest<KickoffDto>(
    `/offer-closing/ouvs/${ouvId}/kickoff`,
    { method: 'PUT', body: kickoffToPayload(record) },
  );
  return kickoffFromDto(dto);
}

/** Borra el kickoff y cancela en Microsoft 365 el evento asociado. */
export async function deleteKickoff(ouvId: string): Promise<void> {
  try {
    await apiRequest<void>(`/offer-closing/ouvs/${ouvId}/kickoff`, {
      method: 'DELETE',
    });
  } catch (error) {
    // 404 = la OUV nunca llegó a tener kickoff guardado; nada que borrar.
    if (error instanceof ApiError && error.status === 404) return;
    throw error;
  }
}
