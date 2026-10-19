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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
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
  create(
    @Body() dto: CreateAccountDto,
    @Req() request: Request,
  ): Promise<AccountResponseDto> {
    return this.accountsService.createAccount(dto, request.ability);
  }

  @Patch(':accountId')
  @CheckAbility({ action: 'update', subject: 'Account' })
  update(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateAccountDto,
    @Req() request: Request,
  ): Promise<AccountResponseDto> {
    return this.accountsService.updateAccount(accountId, dto, request.ability);
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
