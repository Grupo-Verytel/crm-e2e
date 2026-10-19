import { Controller, Get, Query } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AssignedOuvsQueryDto } from '../dtos/assigned-ouvs-query.dto';
import { PaginatedAssignedOuvsDto } from '../dtos/assigned-ouvs-response.dto';
import { AssignedOuvsService } from '../services/assigned-ouvs.service';

@Controller('qualification/assigned-ouvs')
export class AssignedOuvsController {
  constructor(private readonly assignedOuvs: AssignedOuvsService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  list(
    @Query() query: AssignedOuvsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedAssignedOuvsDto> {
    return this.assignedOuvs.list(query, user.userId, user.roleName);
  }
}
