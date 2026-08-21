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
  AccountResponseDto,
  AccountsQueryDto,
  CreateAccountDto,
  PaginatedAccountsResponseDto,
  UpdateAccountDto,
} from '../dtos/accounts.dto';
import { AccountsService } from '../services/accounts.service';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Account' })
  list(
    @Query() query: AccountsQueryDto,
  ): Promise<PaginatedAccountsResponseDto> {
    return this.accountsService.listAccounts(query);
  }

  @Get(':accountId')
  @CheckAbility({ action: 'read', subject: 'Account' })
  get(
    @Param('accountId', ParseUUIDPipe) accountId: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.getAccount(accountId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'create', subject: 'Account' })
  create(@Body() dto: CreateAccountDto): Promise<AccountResponseDto> {
    return this.accountsService.createAccount(dto);
  }

  @Patch(':accountId')
  @CheckAbility({ action: 'update', subject: 'Account' })
  update(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.updateAccount(accountId, dto);
  }

  @Delete(':accountId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'delete', subject: 'Account' })
  async remove(
    @Param('accountId', ParseUUIDPipe) accountId: string,
  ): Promise<void> {
    await this.accountsService.deleteAccount(accountId);
  }
}
