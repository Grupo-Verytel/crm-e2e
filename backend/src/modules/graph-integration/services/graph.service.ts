import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GRAPH_AVAILABILITY_INTERVAL,
  GRAPH_DEFAULT_TIMEZONE,
  GRAPH_ORG_DOMAINS,
  KICKOFF_ROOMS,
  findKickoffRoom,
} from '../constants/graph.constants';
import {
  CreateGraphMeetingDto,
  GraphAttendanceQueryDto,
  GraphAttendanceResponseDto,
  GraphAvailabilityDto,
  GraphAvailabilityResponseDto,
  GraphMeetingResponseDto,
  GraphScheduleDto,
  GraphStatusResponseDto,
  GraphUserDto,
  GraphUsersQueryDto,
  GraphUsersResponseDto,
} from '../dtos/graph.dto';
import { GraphClientService } from './graph-client.service';

type GraphUser = {
  id: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
  jobTitle?: string | null;
  accountEnabled?: boolean | null;
};

type GraphDateTimeTimeZone = {
  dateTime?: string;
  timeZone?: string;
};

type GraphScheduleInformation = {
  scheduleId?: string;
  availabilityView?: string;
  scheduleItems?: {
    status?: string;
    subject?: string;
    start?: GraphDateTimeTimeZone;
    end?: GraphDateTimeTimeZone;
  }[];
  error?: { message?: string; responseCode?: string } | null;
};

type GraphOnlineMeeting = {
  id: string;
  joinWebUrl?: string | null;
};

type GraphAttendanceReport = {
  id: string;
  meetingStartDateTime?: string | null;
  meetingEndDateTime?: string | null;
  totalParticipantCount?: number | null;
};

type GraphAttendanceRecord = {
  emailAddress?: string | null;
  totalAttendanceInSeconds?: number | null;
  role?: string | null;
  identity?: { displayName?: string | null } | null;
  attendanceIntervals?: unknown[] | null;
};

type GraphEvent = {
  id: string;
  subject?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  attendees?: {
    type?: string;
    emailAddress?: { name?: string; address?: string };
  }[];
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string };
  webLink?: string;
};

const USER_SELECT =
  'id,displayName,mail,userPrincipalName,jobTitle,accountEnabled';

/** TTL del caché de usuarios por dominio: el directorio cambia poco. */
const USERS_CACHE_TTL_MS = 5 * 60_000;

/**
 * Casos de uso de Microsoft Graph que consume el CRM.
 *
 * Es el mismo conjunto de operaciones del toolkit interno `MicrosoftGraph`
 * (usuarios por dominio, disponibilidad de salas y creación de reuniones de
 * Teams), expuesto aquí para el agendamiento del Kickoff.
 */
@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);
  private readonly usersCache = new Map<
    string,
    { fetchedAt: number; users: GraphUserDto[] }
  >();

  constructor(
    private readonly client: GraphClientService,
    private readonly configService: ConfigService,
  ) {}

  get domains(): string[] {
    const configured = this.configService
      .get<string>('GRAPH_ORG_DOMAINS', '')
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);
    return configured.length > 0 ? configured : GRAPH_ORG_DOMAINS;
  }

  get timeZone(): string {
    return (
      this.configService.get<string>('GRAPH_TIMEZONE')?.trim() ||
      GRAPH_DEFAULT_TIMEZONE
    );
  }

  get organizerUpn(): string | null {
    return (
      this.configService.get<string>('GRAPH_ORGANIZER_UPN')?.trim() || null
    );
  }

  async getStatus(): Promise<GraphStatusResponseDto> {
    let roles: string[] = [];
    if (this.client.isConfigured) {
      try {
        roles = await this.client.getRoles();
      } catch (error) {
        this.logger.warn(
          `No se pudieron leer los roles de Graph: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return {
      configured: this.client.isConfigured,
      missingEnv: this.client.missingEnv,
      domains: this.domains,
      timeZone: this.timeZone,
      organizerUpn: this.organizerUpn,
      roles,
      canCreateMeetings: roles.includes('Calendars.ReadWrite'),
      rooms: KICKOFF_ROOMS.map((room) => ({ ...room })),
    };
  }

  /**
   * Usuarios de la organización, filtrados en memoria por nombre o correo.
   *
   * Graph no permite `startswith` combinado con `endswith(mail,…)` sin
   * `$search`, así que se lista el dominio completo (con caché) y el filtro de
   * texto se aplica aquí: los directorios de Verytel/Frisson son pequeños.
   */
  async listUsers(query: GraphUsersQueryDto): Promise<GraphUsersResponseDto> {
    const domains = query.domain ? [query.domain.toLowerCase()] : this.domains;
    const search = query.search?.trim().toLowerCase() ?? '';
    const limit = query.limit ?? 25;

    const byEmail = new Map<string, GraphUserDto>();
    for (const domain of domains) {
      for (const user of await this.listDomainUsers(domain)) {
        byEmail.set(user.email.toLowerCase(), user);
      }
    }

    let users = [...byEmail.values()];
    if (search) {
      users = users.filter(
        (user) =>
          user.displayName.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search),
      );
    }
    users.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));

    return {
      domains,
      count: users.length,
      users: users.slice(0, limit),
    };
  }

  /** Disponibilidad (`getSchedule`) de personas y/o salas en una ventana. */
  async getAvailability(
    dto: GraphAvailabilityDto,
  ): Promise<GraphAvailabilityResponseDto> {
    const timeZone = dto.timeZone?.trim() || this.timeZone;
    const startTime = normalizeGraphDateTime(dto.startTime);
    const endTime = normalizeGraphDateTime(dto.endTime);

    if (new Date(endTime) <= new Date(startTime)) {
      throw new BadRequestException('endTime debe ser posterior a startTime.');
    }

    const emails = [
      ...new Set(dto.schedules.map((email) => email.trim().toLowerCase())),
    ];

    const actorUpn = dto.organizerUpn?.trim() || this.organizerUpn;
    const schedules = actorUpn
      ? await this.getScheduleAsOrganizer(
          actorUpn,
          emails,
          startTime,
          endTime,
          timeZone,
        )
      : await this.getScheduleParaCadaBuzon(
          emails,
          startTime,
          endTime,
          timeZone,
        );

    return {
      startTime,
      endTime,
      timeZone,
      intervalMinutes: GRAPH_AVAILABILITY_INTERVAL,
      schedules,
    };
  }

  /** Crea el evento de calendario (con reunión de Teams) del Kickoff. */
  async createMeeting(
    dto: CreateGraphMeetingDto,
  ): Promise<GraphMeetingResponseDto> {
    const draft = await this.buildEventDraft(dto);
    const event = await this.client.request<GraphEvent>(
      'POST',
      `/users/${draft.organizer.id}/events`,
      {
        data: draft.payload,
        headers: outlookPreferHeader(draft.timeZone),
      },
    );
    return this.toMeetingResponse(event, draft);
  }

  /**
   * Reprograma el evento existente en lugar de cancelarlo y crear otro.
   *
   * Al hacer `PATCH` sobre el mismo evento, Outlook y Teams envían a los
   * invitados una actualización de la convocatoria ("Actualizada:") y el
   * enlace de Teams se conserva. Cancelar y volver a crear, en cambio, deja la
   * reunión original marcada como cancelada en el calendario de todos.
   */
  async updateMeeting(
    eventId: string,
    dto: CreateGraphMeetingDto,
  ): Promise<GraphMeetingResponseDto> {
    const draft = await this.buildEventDraft(dto);

    // `onlineMeetingProvider` es inmutable después de crear el evento: si se
    // reenvía, Graph responde 400. `isOnlineMeeting` sí admite cambio.
    const payload = { ...draft.payload };
    delete payload.onlineMeetingProvider;

    const event = await this.client.request<GraphEvent>(
      'PATCH',
      `/users/${draft.organizer.id}/events/${encodeURIComponent(eventId)}`,
      {
        data: payload,
        headers: outlookPreferHeader(draft.timeZone),
      },
    );
    return this.toMeetingResponse(event, draft);
  }

  /**
   * Arma el cuerpo del evento de Graph a partir del DTO. Lo comparten el alta y
   * la reprogramación para que ambas envíen exactamente los mismos datos.
   */
  private async buildEventDraft(dto: CreateGraphMeetingDto): Promise<{
    organizer: GraphUser;
    payload: Record<string, unknown>;
    subject: string;
    timeZone: string;
    startDateTime: string;
    endDateTime: string;
    locationName: string | null;
  }> {
    const organizerUpn = dto.organizerUpn?.trim() || this.organizerUpn;
    if (!organizerUpn) {
      throw new BadRequestException(
        'Indique el organizador de la reunión (su correo Verytel/Frisson) o configure GRAPH_ORGANIZER_UPN en el backend.',
      );
    }

    const timeZone = dto.timeZone?.trim() || this.timeZone;
    const startDateTime = normalizeGraphDateTime(dto.startTime);
    const endDateTime = normalizeGraphDateTime(dto.endTime);
    if (new Date(endDateTime) <= new Date(startDateTime)) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la de inicio.',
      );
    }

    const organizer = await this.client.request<GraphUser>(
      'GET',
      `/users/${encodeURIComponent(organizerUpn)}`,
      { params: { $select: 'id,displayName,mail,userPrincipalName' } },
    );

    const attendees = new Map<
      string,
      { emailAddress: { address: string; name?: string }; type: string }
    >();
    for (const attendee of dto.attendees ?? []) {
      const address = attendee.email.trim();
      if (!address) continue;
      attendees.set(address.toLowerCase(), {
        emailAddress: attendee.name
          ? { address, name: attendee.name }
          : { address },
        type: attendee.type ?? 'required',
      });
    }

    const room = dto.room ? findKickoffRoom(dto.room) : undefined;
    if (dto.room && !room) {
      throw new BadRequestException(
        `Sala desconocida: ${dto.room}. Salas válidas: ${KICKOFF_ROOMS.map(
          (r) => r.nombre,
        ).join(', ')}.`,
      );
    }
    if (room) {
      attendees.set(room.email.toLowerCase(), {
        emailAddress: { address: room.email, name: room.nombre },
        type: 'resource',
      });
    }

    const isOnlineMeeting = dto.isOnlineMeeting !== false;
    const locationName = room?.nombre ?? dto.location?.trim() ?? null;
    const outlookTimeZone = toOutlookTimeZone(timeZone);

    const payload: Record<string, unknown> = {
      subject: dto.subject.trim(),
      start: { dateTime: startDateTime, timeZone: outlookTimeZone },
      end: { dateTime: endDateTime, timeZone: outlookTimeZone },
      originalStartTimeZone: outlookTimeZone,
      originalEndTimeZone: outlookTimeZone,
      attendees: [...attendees.values()],
      isOnlineMeeting,
    };
    if (isOnlineMeeting) {
      payload.onlineMeetingProvider = 'teamsForBusiness';
    }
    if (dto.body?.trim()) {
      payload.body = { contentType: 'Text', content: dto.body.trim() };
    }
    if (locationName) {
      payload.location = room
        ? { displayName: room.nombre, locationEmailAddress: room.email }
        : { displayName: locationName };
    }

    return {
      organizer,
      payload,
      subject: payload.subject as string,
      timeZone,
      startDateTime,
      endDateTime,
      locationName,
    };
  }

  private toMeetingResponse(
    event: GraphEvent,
    draft: {
      organizer: GraphUser;
      payload: Record<string, unknown>;
      subject: string;
      timeZone: string;
      startDateTime: string;
      endDateTime: string;
      locationName: string | null;
    },
  ): GraphMeetingResponseDto {
    const { organizer, subject, timeZone, startDateTime, endDateTime } = draft;
    return {
      eventId: event.id,
      subject: event.subject ?? subject,
      start: event.start?.dateTime ?? startDateTime,
      end: event.end?.dateTime ?? endDateTime,
      timeZone: event.start?.timeZone ?? timeZone,
      organizer: {
        name: organizer.displayName ?? null,
        email: organizer.mail ?? organizer.userPrincipalName ?? null,
      },
      attendees: (event.attendees ?? []).map((attendee) => ({
        name: attendee.emailAddress?.name ?? null,
        email: attendee.emailAddress?.address ?? null,
        type: attendee.type ?? 'required',
      })),
      joinUrl: event.onlineMeeting?.joinUrl ?? null,
      webLink: event.webLink ?? null,
      location: event.location?.displayName ?? draft.locationName,
    };
  }

  /**
   * Asistencia real a la reunión de Teams del Kickoff.
   *
   * Teams publica el informe cuando la reunión termina, así que antes de eso
   * la respuesta llega con `reportId: null` y sin asistentes: eso no es un
   * error, es «todavía no hay informe». Cuando hay varios informes (la reunión
   * se reabrió) se toma el último.
   */
  async getMeetingAttendance(
    dto: GraphAttendanceQueryDto,
  ): Promise<GraphAttendanceResponseDto> {
    const organizerUpn = dto.organizerUpn.trim();
    const joinUrl = dto.joinUrl?.trim();
    const meetingIdInput = dto.meetingId?.trim();

    if (!meetingIdInput && !joinUrl) {
      throw new BadRequestException('Indique meetingId o joinUrl.');
    }

    // Con permisos de aplicación la API de onlineMeetings exige el object id
    // del organizador, no su UPN.
    const organizer = await this.client.request<GraphUser>(
      'GET',
      `/users/${encodeURIComponent(organizerUpn)}`,
      { params: { $select: 'id' } },
    );

    const meetingId =
      meetingIdInput ??
      (await this.resolveOnlineMeetingId(organizer.id, joinUrl as string));

    const basePath = `/users/${organizer.id}/onlineMeetings/${encodeURIComponent(
      meetingId,
    )}/attendanceReports`;

    const reports = await this.client.request<{
      value?: GraphAttendanceReport[];
    }>('GET', basePath);

    const reportList = reports.value ?? [];
    if (reportList.length === 0) {
      return {
        meetingId,
        reportId: null,
        meetingStartDateTime: null,
        meetingEndDateTime: null,
        totalParticipantCount: null,
        attendees: [],
      };
    }

    const latest = reportList[reportList.length - 1];
    const records = await this.client.request<{
      value?: GraphAttendanceRecord[];
    }>('GET', `${basePath}/${encodeURIComponent(latest.id)}/attendanceRecords`);

    return {
      meetingId,
      reportId: latest.id,
      meetingStartDateTime: latest.meetingStartDateTime ?? null,
      meetingEndDateTime: latest.meetingEndDateTime ?? null,
      totalParticipantCount: latest.totalParticipantCount ?? null,
      attendees: (records.value ?? []).map((record) => ({
        name: record.identity?.displayName ?? null,
        email: record.emailAddress ?? null,
        totalAttendanceInSeconds: record.totalAttendanceInSeconds ?? 0,
        role: record.role ?? null,
        intervals: record.attendanceIntervals?.length ?? 0,
      })),
    };
  }

  /** Traduce el enlace de Teams guardado en el kickoff a un `meetingId`. */
  private async resolveOnlineMeetingId(
    organizerId: string,
    joinUrl: string,
  ): Promise<string> {
    // El filtro va entre comillas simples; una comilla en la URL rompería la
    // consulta OData, así que se escapa duplicándola.
    const filter = `JoinWebUrl eq '${joinUrl.replace(/'/g, "''")}'`;
    const found = await this.client.request<{ value?: GraphOnlineMeeting[] }>(
      'GET',
      `/users/${organizerId}/onlineMeetings`,
      { params: { $filter: filter } },
    );

    const meetingId = found.value?.[0]?.id;
    if (!meetingId) {
      throw new NotFoundException(
        'No se encontró la reunión de Teams para ese organizador. Puede que el evento se haya creado sin reunión en línea.',
      );
    }
    return meetingId;
  }

  /** Cancela (elimina) el evento creado para el Kickoff. */
  async cancelMeeting(eventId: string, organizerUpn?: string): Promise<void> {
    const upn = organizerUpn?.trim() || this.organizerUpn;
    if (!upn) {
      throw new BadRequestException(
        'No hay organizador para cancelar la reunión: configura GRAPH_ORGANIZER_UPN.',
      );
    }
    const organizer = await this.client.request<GraphUser>(
      'GET',
      `/users/${encodeURIComponent(upn)}`,
      { params: { $select: 'id' } },
    );
    const eventPath = `/users/${organizer.id}/events/${encodeURIComponent(eventId)}`;
    try {
      // `/cancel` avisa a los invitados; solo aplica si el evento es una
      // reunión con asistentes y el buzón es el organizador.
      await this.client.request('POST', `${eventPath}/cancel`, {
        data: { comment: 'Kickoff cancelado desde el CRM.' },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo cancelar el evento ${eventId}; se elimina del calendario: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.client.request('DELETE', eventPath);
    }
  }

  private async listDomainUsers(domain: string): Promise<GraphUserDto[]> {
    const cached = this.usersCache.get(domain);
    if (cached && Date.now() - cached.fetchedAt < USERS_CACHE_TTL_MS) {
      return cached.users;
    }

    const raw = await this.client.requestAll<GraphUser>('/users', {
      params: {
        $filter: `endswith(mail,'@${domain}')`,
        $select: USER_SELECT,
        $top: 999,
        $count: true,
      },
      headers: { ConsistencyLevel: 'eventual' },
    });

    const users = raw
      .filter((user) => user.accountEnabled !== false)
      .map((user) => {
        const email = (user.mail ?? user.userPrincipalName ?? '').trim();
        return {
          id: user.id,
          displayName: user.displayName?.trim() || email,
          email,
          jobTitle: user.jobTitle?.trim() || null,
          domain,
        };
      })
      .filter((user) => user.email.length > 0);

    this.usersCache.set(domain, { fetchedAt: Date.now(), users });
    return users;
  }

  /**
   * Una sola llamada `getSchedule` desde el buzón del organizador. Requiere
   * que la Application Access Policy de Exchange incluya ese buzón.
   */
  private async getScheduleAsOrganizer(
    organizerUpn: string,
    emails: string[],
    startTime: string,
    endTime: string,
    timeZone: string,
  ): Promise<GraphScheduleDto[]> {
    try {
      const data = await this.client.request<{
        value?: GraphScheduleInformation[];
      }>(
        'POST',
        `/users/${encodeURIComponent(organizerUpn)}/calendar/getSchedule`,
        {
          data: {
            schedules: emails,
            startTime: {
              dateTime: startTime,
              timeZone: toOutlookTimeZone(timeZone),
            },
            endTime: { dateTime: endTime, timeZone: toOutlookTimeZone(timeZone) },
            availabilityViewInterval: GRAPH_AVAILABILITY_INTERVAL,
          },
        },
      );
      const byId = new Map(
        (data.value ?? []).map((item) => [
          (item.scheduleId ?? '').toLowerCase(),
          item,
        ]),
      );
      return emails.map((email) =>
        toScheduleDto(email, byId.get(email), timeZone),
      );
    } catch (error) {
      this.logger.warn(
        `getSchedule desde ${organizerUpn} falló; se consulta buzón por buzón: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.getScheduleParaCadaBuzon(
        emails,
        startTime,
        endTime,
        timeZone,
      );
    }
  }

  /**
   * `getSchedule` contra el propio buzón de cada recurso — es lo que hace el
   * toolkit `MicrosoftGraph` para las salas y no depende de un organizador.
   */
  private async getScheduleParaCadaBuzon(
    emails: string[],
    startTime: string,
    endTime: string,
    timeZone: string,
  ): Promise<GraphScheduleDto[]> {
    const results = await Promise.all(
      emails.map(async (email): Promise<GraphScheduleDto> => {
        try {
          const data = await this.client.request<{
            value?: GraphScheduleInformation[];
          }>(
            'POST',
            `/users/${encodeURIComponent(email)}/calendar/getSchedule`,
            {
              data: {
                schedules: [email],
                startTime: {
                  dateTime: startTime,
                  timeZone: toOutlookTimeZone(timeZone),
                },
                endTime: {
                  dateTime: endTime,
                  timeZone: toOutlookTimeZone(timeZone),
                },
                availabilityViewInterval: GRAPH_AVAILABILITY_INTERVAL,
              },
            },
          );
          return toScheduleDto(email, (data.value ?? [])[0], timeZone);
        } catch (error) {
          return {
            email,
            availabilityView: null,
            items: [],
            error:
              error instanceof Error
                ? error.message
                : 'No se pudo leer el calendario',
          };
        }
      }),
    );
    return results;
  }
}

function toScheduleDto(
  email: string,
  info: GraphScheduleInformation | undefined,
  targetTimeZone: string,
): GraphScheduleDto {
  return {
    email,
    availabilityView: info?.availabilityView ?? null,
    items: (info?.scheduleItems ?? []).map((item) => ({
      status: item.status ?? 'busy',
      subject: item.subject ?? null,
      start: toRequestedZoneDateTime(item.start, targetTimeZone),
      end: toRequestedZoneDateTime(item.end, targetTimeZone),
    })),
    error: info?.error?.message ?? null,
  };
}

/** Graph exige segundos en `dateTime`; el frontend envía `YYYY-MM-DDTHH:mm`. */
function normalizeGraphDateTime(value: string): string {
  const raw = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00` : raw;
}

/**
 * Outlook / Teams interpretan mal IANA `America/Bogota` en reuniones en
 * línea y muestran UTC. El id de Windows para Colombia (UTC-5, sin DST)
 * es el que Graph espera.
 */
function toOutlookTimeZone(timeZone: string): string {
  const normalized = timeZone.trim();
  if (
    normalized === 'America/Bogota' ||
    normalized === 'America/Bogotá' ||
    normalized.toLowerCase() === 'bogota'
  ) {
    return 'SA Pacific Standard Time';
  }
  return normalized;
}

function outlookPreferHeader(timeZone: string): Record<string, string> {
  return {
    Prefer: `outlook.timezone="${toOutlookTimeZone(timeZone)}"`,
  };
}

/**
 * `getSchedule` returns scheduleItems in UTC (`timeZone: UTC`, no offset on
 * dateTime). The CRM grid is America/Bogota; convert before the frontend
 * paints the block or it shows 13:00 for an 08:00 Colombia meeting.
 */
function toRequestedZoneDateTime(
  value: GraphDateTimeTimeZone | undefined,
  targetTimeZone: string,
): string {
  const dateTime = value?.dateTime?.trim() ?? '';
  if (!dateTime) return '';
  const instant = parseGraphInstant(dateTime, value?.timeZone);
  if (!instant) return dateTime;
  return toWallClockInZone(instant, toIanaTimeZone(targetTimeZone));
}

function parseGraphInstant(
  dateTime: string,
  sourceTimeZone?: string,
): Date | null {
  const raw = dateTime.trim();
  if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}(\.\d+)?$/.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    raw,
  );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? '0');
  const tz = (sourceTimeZone ?? 'UTC').trim();

  if (isColombiaTimeZone(tz)) {
    const stamp = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${String(second).padStart(2, '0')}-05:00`;
    const parsed = new Date(stamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

function isColombiaTimeZone(timeZone: string): boolean {
  const normalized = timeZone.trim().toLowerCase();
  return (
    normalized === 'america/bogota' ||
    normalized === 'america/bogotá' ||
    normalized === 'sa pacific standard time' ||
    normalized === 'bogota'
  );
}

function toIanaTimeZone(timeZone: string): string {
  if (isColombiaTimeZone(timeZone)) {
    return 'America/Bogota';
  }
  const normalized = timeZone.trim();
  if (
    normalized.toUpperCase() === 'UTC' ||
    normalized.toUpperCase() === 'UTC STANDARD TIME'
  ) {
    return 'UTC';
  }
  return normalized || 'America/Bogota';
}

function toWallClockInZone(instant: Date, ianaTimeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ianaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}
