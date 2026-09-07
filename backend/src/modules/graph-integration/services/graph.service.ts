import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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

type GraphScheduleInformation = {
  scheduleId?: string;
  availabilityView?: string;
  scheduleItems?: {
    status?: string;
    subject?: string;
    start?: { dateTime?: string };
    end?: { dateTime?: string };
  }[];
  error?: { message?: string; responseCode?: string } | null;
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
      { data: draft.payload },
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
      { data: payload },
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

    const payload: Record<string, unknown> = {
      subject: dto.subject.trim(),
      start: { dateTime: startDateTime, timeZone },
      end: { dateTime: endDateTime, timeZone },
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
            startTime: { dateTime: startTime, timeZone },
            endTime: { dateTime: endTime, timeZone },
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
      return emails.map((email) => toScheduleDto(email, byId.get(email)));
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
                startTime: { dateTime: startTime, timeZone },
                endTime: { dateTime: endTime, timeZone },
                availabilityViewInterval: GRAPH_AVAILABILITY_INTERVAL,
              },
            },
          );
          return toScheduleDto(email, (data.value ?? [])[0]);
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
): GraphScheduleDto {
  return {
    email,
    availabilityView: info?.availabilityView ?? null,
    items: (info?.scheduleItems ?? []).map((item) => ({
      status: item.status ?? 'busy',
      subject: item.subject ?? null,
      start: item.start?.dateTime ?? '',
      end: item.end?.dateTime ?? '',
    })),
    error: info?.error?.message ?? null,
  };
}

/** Graph exige segundos en `dateTime`; el frontend envía `YYYY-MM-DDTHH:mm`. */
function normalizeGraphDateTime(value: string): string {
  const raw = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00` : raw;
}
