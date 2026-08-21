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
  Query,
} from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import {
  CreatePersonDto,
  PaginatedPeopleResponseDto,
  PeopleQueryDto,
  PersonResponseDto,
  UpdatePersonDto,
} from '../dtos/accounts.dto';
import { AccountsService } from '../services/accounts.service';

@Controller('accounts/people')
export class PeopleController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Person' })
  list(@Query() query: PeopleQueryDto): Promise<PaginatedPeopleResponseDto> {
    return this.accountsService.listPeople(query);
  }

  @Get(':personId')
  @CheckAbility({ action: 'read', subject: 'Person' })
  get(
    @Param('personId', ParseUUIDPipe) personId: string,
  ): Promise<PersonResponseDto> {
    return this.accountsService.getPerson(personId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'create', subject: 'Person' })
  create(@Body() dto: CreatePersonDto): Promise<PersonResponseDto> {
    return this.accountsService.createPerson(dto);
  }

  @Patch(':personId')
  @CheckAbility({ action: 'update', subject: 'Person' })
  update(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Body() dto: UpdatePersonDto,
  ): Promise<PersonResponseDto> {
    return this.accountsService.updatePerson(personId, dto);
  }

  @Delete(':personId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'delete', subject: 'Person' })
  async remove(
    @Param('personId', ParseUUIDPipe) personId: string,
  ): Promise<void> {
    await this.accountsService.deletePerson(personId);
  }
}
