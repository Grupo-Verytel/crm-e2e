import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import {
  CreateDefaultMeetingAttendeeDto,
  DefaultMeetingAttendeeListResponseDto,
  DefaultMeetingAttendeeResponseDto,
  DeleteDefaultMeetingAttendeeResponseDto,
  UpdateDefaultMeetingAttendeeDto,
} from '../dtos/default-meeting-attendee.dto';
import { DefaultMeetingAttendeesService } from '../services/default-meeting-attendees.service';

const MANAGE = {
  action: 'manage_default_attendees',
  subject: 'DefaultMeetingAttendee',
} as const;

@Controller('qualification/default-meeting-attendees')
export class DefaultMeetingAttendeesController {
  constructor(
    private readonly defaultMeetingAttendeesService: DefaultMeetingAttendeesService,
  ) {}

  @Get()
  @CheckAbility(MANAGE)
  list(): Promise<DefaultMeetingAttendeeListResponseDto> {
    return this.defaultMeetingAttendeesService.list();
  }

  @Post()
  @CheckAbility(MANAGE)
  create(
    @Body() dto: CreateDefaultMeetingAttendeeDto,
  ): Promise<DefaultMeetingAttendeeResponseDto> {
    return this.defaultMeetingAttendeesService.create(dto);
  }

  @Patch(':id')
  @CheckAbility(MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDefaultMeetingAttendeeDto,
  ): Promise<DefaultMeetingAttendeeResponseDto> {
    return this.defaultMeetingAttendeesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @CheckAbility(MANAGE)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeleteDefaultMeetingAttendeeResponseDto> {
    return this.defaultMeetingAttendeesService.remove(id);
  }
}
