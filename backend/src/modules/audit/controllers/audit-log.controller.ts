import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuditLogQueryDto } from '../dtos/audit-log-query.dto';
import { PaginatedAuditLogResponseDto } from '../dtos/audit-log-response.dto';
import { AuditService } from '../services/audit.service';

@Controller('audit-log')
@UseGuards(AdminGuard)
export class AuditLogController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(
    @Query() query: AuditLogQueryDto,
  ): Promise<PaginatedAuditLogResponseDto> {
    return this.auditService.findAll(query);
  }
}
