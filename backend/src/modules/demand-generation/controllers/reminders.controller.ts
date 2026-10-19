import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { MyRemindersQueryDto } from '../dtos/my-reminders-query.dto';
import { PaginatedMyRemindersDto } from '../dtos/my-reminders-response.dto';
import { ReminderActionResponseDto } from '../dtos/reminder-response.dto';
import { RemindersService } from '../services/reminders.service';

/**
 * Complete and cancel for both reminder sources.
 *
 * There is no CASL subject `Reminder`. These routes stay behind JWT and
 * allow only `reminders.user_id = actor`. A `CheckAbility` on `Opportunity`
 * would reject the owner of a lead reminder who does not have that subject.
 */
@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  list(
    @Query() query: MyRemindersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedMyRemindersDto> {
    return this.reminders.listMine(query, user.userId);
  }

  @Patch(':reminderId/complete')
  complete(
    @Param('reminderId', new ParseUUIDPipe({ version: '4' }))
    reminderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReminderActionResponseDto> {
    return this.reminders.complete(reminderId, user.userId);
  }

  @Patch(':reminderId/cancel')
  cancel(
    @Param('reminderId', new ParseUUIDPipe({ version: '4' }))
    reminderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReminderActionResponseDto> {
    return this.reminders.cancel(reminderId, user.userId);
  }
}
