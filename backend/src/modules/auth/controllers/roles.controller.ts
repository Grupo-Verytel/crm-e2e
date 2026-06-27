import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';
import { RoleResponseDto, UpdateRoleDto } from '../dtos/role-response.dto';
import { RolesService } from '../services/roles.service';

@Controller('roles')
@UseGuards(AdminGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(): Promise<RoleResponseDto[]> {
    return this.rolesService.findAll();
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.update(id, dto);
  }
}
