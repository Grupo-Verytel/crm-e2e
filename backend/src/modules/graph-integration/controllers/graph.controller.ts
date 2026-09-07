import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateGraphMeetingDto,
  GraphAvailabilityDto,
  GraphAvailabilityResponseDto,
  GraphMeetingResponseDto,
  GraphStatusResponseDto,
  GraphUsersQueryDto,
  GraphUsersResponseDto,
} from '../dtos/graph.dto';
import { GraphService } from '../services/graph.service';

/**
 * Fachada del CRM sobre Microsoft Graph (`api/v1/graph/*`).
 *
 * Todas las rutas quedan detrás del `JwtAuthGuard` global: el secreto de la
 * app de Entra ID nunca sale del backend.
 */
@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get('status')
  status(): Promise<GraphStatusResponseDto> {
    return this.graphService.getStatus();
  }

  @Get('users')
  users(@Query() query: GraphUsersQueryDto): Promise<GraphUsersResponseDto> {
    return this.graphService.listUsers(query);
  }

  @Post('availability')
  @HttpCode(HttpStatus.OK)
  availability(
    @Body() dto: GraphAvailabilityDto,
  ): Promise<GraphAvailabilityResponseDto> {
    return this.graphService.getAvailability(dto);
  }

  @Post('meetings')
  @HttpCode(HttpStatus.CREATED)
  createMeeting(
    @Body() dto: CreateGraphMeetingDto,
  ): Promise<GraphMeetingResponseDto> {
    return this.graphService.createMeeting(dto);
  }

  /** Reprograma la reunión existente: los invitados reciben una actualización. */
  @Patch('meetings/:eventId')
  @HttpCode(HttpStatus.OK)
  updateMeeting(
    @Param('eventId') eventId: string,
    @Body() dto: CreateGraphMeetingDto,
  ): Promise<GraphMeetingResponseDto> {
    return this.graphService.updateMeeting(eventId, dto);
  }

  @Delete('meetings/:eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelMeeting(
    @Param('eventId') eventId: string,
    @Query('organizerUpn') organizerUpn?: string,
  ): Promise<void> {
    return this.graphService.cancelMeeting(eventId, organizerUpn);
  }
}
